package com.example.gateway.service;

import com.example.gateway.domain.ConcessionApplication;
import com.example.gateway.domain.ConcessionStatus;
import com.example.gateway.domain.PassengerCategory;
import com.example.gateway.repo.ConcessionApplicationRepository;
import com.example.gateway.repo.ReservationRepository;
import com.example.gateway.repo.ReservationRepository.PassengerInfo;
import com.example.gateway.repo.ReservationRepository.Reservation;
import com.example.gateway.web.ApiException;
import com.example.gateway.web.Dtos.ConcessionResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConcessionServiceTest {

    @Mock
    private ConcessionApplicationRepository concessionRepo;
    @Mock
    private ReservationRepository reservations;

    private ConcessionService concessionService;

    @BeforeEach
    void setUp() {
        concessionService = new ConcessionService(
                concessionRepo,
                reservations,
                BigDecimal.ZERO,
                BigDecimal.valueOf(40), // senior citizen: 40%
                BigDecimal.valueOf(25), // student: 25%
                BigDecimal.valueOf(50), // child: 50%
                BigDecimal.valueOf(50), // differently abled: 50%
                BigDecimal.valueOf(30)  // armed forces: 30%
        );
    }

    @Test
    void testCalculateSeniorCitizen() {
        ConcessionResult result = concessionService.calculate(PassengerCategory.SENIOR_CITIZEN, BigDecimal.valueOf(1000));
        assertEquals(BigDecimal.valueOf(40), result.percent());
        assertEquals(BigDecimal.valueOf(400.00).setScale(2), result.concessionAmount());
        assertEquals(BigDecimal.valueOf(600.00).setScale(2), result.finalAmount());
    }

    @Test
    void testCalculateStudent() {
        ConcessionResult result = concessionService.calculate(PassengerCategory.STUDENT, BigDecimal.valueOf(1000));
        assertEquals(BigDecimal.valueOf(25), result.percent());
        assertEquals(BigDecimal.valueOf(250.00).setScale(2), result.concessionAmount());
        assertEquals(BigDecimal.valueOf(750.00).setScale(2), result.finalAmount());
    }

    @Test
    void applicationsAreOnlyForTheBookingOwner() {
        when(reservations.find("1000000016")).thenReturn(Optional.of(
                new Reservation("1000000016", 5, "CONFIRMED", BigDecimal.valueOf(1000), false, LocalDate.now())));
        assertThrows(ApiException.class, () -> concessionService.createApplication(
                "1000000016", 7, 6, false, PassengerCategory.STUDENT, null, null, null));
    }

    @Test
    void testCreateApplicationAndReview() {
        ConcessionApplication mockApp = new ConcessionApplication();
        mockApp.setId(10L);
        mockApp.setStatus(ConcessionStatus.PENDING);

        when(concessionRepo.save(any(ConcessionApplication.class))).thenReturn(mockApp);
        when(concessionRepo.findById(10L)).thenReturn(Optional.of(mockApp));
        when(reservations.find("1000000016")).thenReturn(Optional.of(
                new Reservation("1000000016", 5, "CONFIRMED", BigDecimal.valueOf(1000), false, LocalDate.now())));
        when(reservations.passenger("1000000016", 7)).thenReturn(Optional.of(
                new PassengerInfo(7, "Rahul Sharma", BigDecimal.valueOf(1000), "CONFIRMED")));

        ConcessionApplication app = concessionService.createApplication(
                "1000000016", 7, 5, false, PassengerCategory.STUDENT,
                "STUDENT_ID", "STU12345", "https://docs.railway.test/stu12345.pdf"
        );
        assertEquals(ConcessionStatus.PENDING, app.getStatus());

        ConcessionApplication reviewed = concessionService.review(10L, ConcessionStatus.APPROVED, 99, "Verified ID card");
        assertEquals(ConcessionStatus.APPROVED, reviewed.getStatus());
        assertEquals(99, reviewed.getVerifiedByStaffId());
    }
}
