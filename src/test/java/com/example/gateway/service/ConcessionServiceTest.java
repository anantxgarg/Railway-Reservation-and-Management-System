package com.example.gateway.service;

import com.example.gateway.domain.ConcessionApplication;
import com.example.gateway.domain.ConcessionStatus;
import com.example.gateway.repo.ConcessionApplicationRepository;
import com.example.gateway.repo.ConcessionRuleRepository;
import com.example.gateway.repo.ConcessionRuleRepository.PassengerConcession;
import com.example.gateway.repo.ConcessionRuleRepository.Rule;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ConcessionServiceTest {

    private static final Rule SENIOR = rule(1, "SENIOR_CITIZEN", "PERCENTAGE", 40);
    private static final Rule STUDENT = rule(2, "STUDENT", "PERCENTAGE", 25);

    @Mock
    private ConcessionApplicationRepository concessionRepo;
    @Mock
    private ConcessionRuleRepository rules;
    @Mock
    private ReservationRepository reservations;

    private ConcessionService concessionService;

    @BeforeEach
    void setUp() {
        concessionService = new ConcessionService(concessionRepo, rules, reservations);
    }

    private static Rule rule(int id, String category, String type, int value) {
        return new Rule(id, category, category, "", type, BigDecimal.valueOf(value), null, null, null);
    }

    @Test
    void percentagesComeFromTheConcessionTable() {
        when(rules.byCategory("SENIOR_CITIZEN")).thenReturn(Optional.of(SENIOR));
        ConcessionResult result = concessionService.calculate("SENIOR_CITIZEN", BigDecimal.valueOf(1000));
        assertEquals(BigDecimal.valueOf(40), result.percent());
        assertEquals(BigDecimal.valueOf(400.00).setScale(2), result.concessionAmount());
        assertEquals(BigDecimal.valueOf(600.00).setScale(2), result.finalAmount());
    }

    @Test
    void fixedAmountNeverGoesBelowZero() {
        when(rules.byCategory("PASS")).thenReturn(Optional.of(rule(3, "PASS", "FIXED_AMOUNT", 300)));
        ConcessionResult result = concessionService.calculate("PASS", BigDecimal.valueOf(200));
        assertNull(result.percent());
        assertEquals(BigDecimal.valueOf(200), result.concessionAmount());
        assertEquals(BigDecimal.ZERO, result.finalAmount());
    }

    @Test
    void generalHasNoDiscountAndUnknownIsRefused() {
        assertEquals(BigDecimal.valueOf(1000), concessionService.calculate("GENERAL", BigDecimal.valueOf(1000)).finalAmount());
        when(rules.byCategory("ROYALTY")).thenReturn(Optional.empty());
        assertThrows(ApiException.class, () -> concessionService.calculate("ROYALTY", BigDecimal.TEN));
    }

    @Test
    void applicationsAreOnlyForTheBookingOwner() {
        when(reservations.find("1000000016")).thenReturn(Optional.of(
                new Reservation("1000000016", 5, "CONFIRMED", BigDecimal.valueOf(1000), false, LocalDate.now(), null)));
        assertThrows(ApiException.class, () -> concessionService.createApplication(
                "1000000016", 7, 6, false, "STUDENT", null, null, null));
    }

    private void studentPassenger() {
        when(reservations.find("1000000016")).thenReturn(Optional.of(
                new Reservation("1000000016", 5, "CONFIRMED", BigDecimal.valueOf(790), false, LocalDate.now(), null)));
        when(reservations.passenger("1000000016", 7)).thenReturn(Optional.of(
                new PassengerInfo(7, "Rahul Sharma", BigDecimal.valueOf(790), "CONFIRMED")));
        when(rules.ofPassenger(7)).thenReturn(Optional.of(
                new PassengerConcession(STUDENT, BigDecimal.valueOf(790), BigDecimal.valueOf(1040))));
    }

    @Test
    void applicationIsForTheConcessionTheyWereBookedWith() {
        studentPassenger();
        ApiException e = assertThrows(ApiException.class, () -> concessionService.createApplication(
                "1000000016", 7, 5, false, "SENIOR_CITIZEN", null, null, null));
        assertEquals("INVALID_INPUT", e.getCode());
    }

    @Test
    void testCreateApplicationAndReview() {
        studentPassenger();
        when(concessionRepo.save(any(ConcessionApplication.class))).thenAnswer(inv -> inv.getArgument(0));

        ConcessionApplication app = concessionService.createApplication(
                "1000000016", 7, 5, false, null,
                "STUDENT_ID", "STU12345", "https://docs.railway.test/stu12345.pdf"
        );
        assertEquals(ConcessionStatus.PENDING, app.getStatus());
        assertEquals("STUDENT", app.getCategory());
        assertEquals(BigDecimal.valueOf(25), app.getDiscountPercent());
        assertEquals(BigDecimal.valueOf(250), app.getDiscountAmount());

        app.setId(10L);
        when(concessionRepo.findById(10L)).thenReturn(Optional.of(app));
        ConcessionApplication reviewed = concessionService.review(10L, ConcessionStatus.APPROVED, 99, "Verified ID card");
        assertEquals(ConcessionStatus.APPROVED, reviewed.getStatus());
        assertEquals(99, reviewed.getVerifiedByStaffId());
    }
}
