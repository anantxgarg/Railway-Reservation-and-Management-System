package com.example.gateway.service;

import com.example.gateway.domain.ConcessionApplication;
import com.example.gateway.domain.ConcessionStatus;
import com.example.gateway.domain.PassengerCategory;
import com.example.gateway.repo.ConcessionApplicationRepository;
import com.example.gateway.repo.ReservationRepository;
import com.example.gateway.repo.ReservationRepository.PassengerInfo;
import com.example.gateway.web.ApiException;
import com.example.gateway.web.Dtos.ConcessionResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Concession calculation, document tracking, and staff verification service.
 */
@Service
public class ConcessionService {

    private final ConcessionApplicationRepository concessionRepo;
    private final ReservationRepository reservations;
    private final Map<PassengerCategory, BigDecimal> rates = new EnumMap<>(PassengerCategory.class);

    public ConcessionService(
            ConcessionApplicationRepository concessionRepo,
            ReservationRepository reservations,
            @Value("${concession.general:0}") BigDecimal general,
            @Value("${concession.senior-citizen:0}") BigDecimal seniorCitizen,
            @Value("${concession.student:0}") BigDecimal student,
            @Value("${concession.child:0}") BigDecimal child,
            @Value("${concession.differently-abled:0}") BigDecimal differentlyAbled,
            @Value("${concession.armed-forces:0}") BigDecimal armedForces) {
        this.concessionRepo = concessionRepo;
        this.reservations = reservations;
        rates.put(PassengerCategory.GENERAL, general);
        rates.put(PassengerCategory.SENIOR_CITIZEN, seniorCitizen);
        rates.put(PassengerCategory.STUDENT, student);
        rates.put(PassengerCategory.CHILD, child);
        rates.put(PassengerCategory.DIFFERENTLY_ABLED, differentlyAbled);
        rates.put(PassengerCategory.ARMED_FORCES, armedForces);
    }

    public ConcessionResult calculate(PassengerCategory category, BigDecimal baseFare) {
        BigDecimal percent = rates.getOrDefault(category, BigDecimal.ZERO);
        BigDecimal discount = Money.percentOf(baseFare, percent);
        BigDecimal finalAmount = baseFare.subtract(discount);
        return new ConcessionResult(category, baseFare, percent, discount, finalAmount);
    }

    /**
     * A concession claim for one passenger of a booking. The passenger's name and
     * fare come from the booking (Team 3); only the booking's owner may apply.
     */
    @Transactional
    public ConcessionApplication createApplication(
            String pnr, Integer passengerId, Integer userId, boolean isAdmin,
            PassengerCategory category,
            String idCardType, String idCardNumber, String documentUrl) {
        reservations.find(pnr)
                .filter(b -> isAdmin || (userId != null && b.userId() == userId))
                .orElseThrow(() -> ApiException.notFound("Booking not found: " + pnr));
        PassengerInfo passenger = reservations.passenger(pnr, passengerId)
                .orElseThrow(() -> ApiException.notFound("Passenger " + passengerId + " is not on booking " + pnr));
        ConcessionResult result = calculate(category, passenger.fare());

        ConcessionApplication app = new ConcessionApplication();
        app.setPnr(pnr);
        app.setPassengerId(passengerId);
        app.setUserId(userId);
        app.setPassengerName(passenger.name());
        app.setCategory(category);
        app.setIdCardType(idCardType != null ? idCardType : "NOT_SPECIFIED");
        app.setIdCardNumber(idCardNumber != null ? idCardNumber : "NOT_SPECIFIED");
        app.setDocumentReferenceUrl(documentUrl);
        app.setDiscountPercent(result.percent());
        app.setDiscountAmount(result.concessionAmount());

        // GENERAL is immediately approved (0% discount). Others require staff review unless automated.
        if (category == PassengerCategory.GENERAL) {
            app.setStatus(ConcessionStatus.APPROVED);
        } else {
            app.setStatus(ConcessionStatus.PENDING);
        }

        return concessionRepo.save(app);
    }

    @Transactional
    public ConcessionApplication review(Long applicationId, ConcessionStatus status, Integer staffId, String remarks) {
        ConcessionApplication app = concessionRepo.findById(applicationId)
                .orElseThrow(() -> ApiException.notFound("Concession application not found: " + applicationId));
        app.setStatus(status);
        app.setVerifiedByStaffId(staffId);
        app.setRemarks(remarks);
        app.setUpdatedAt(OffsetDateTime.now());
        return concessionRepo.save(app);
    }

    public List<ConcessionApplication> getPendingApplications() {
        return concessionRepo.findByStatusOrderByIdDesc(ConcessionStatus.PENDING);
    }

    public List<ConcessionApplication> getForUser(Integer userId) {
        return concessionRepo.findByUserIdOrderByIdDesc(userId);
    }

    /** Applications for a booking: its owner, or staff. */
    public List<ConcessionApplication> getByBooking(String pnr, Integer userId, boolean isStaffOrAdmin) {
        reservations.find(pnr)
                .filter(b -> isStaffOrAdmin || (userId != null && b.userId() == userId))
                .orElseThrow(() -> ApiException.notFound("Booking not found: " + pnr));
        return concessionRepo.findByPnrOrderByIdDesc(pnr);
    }
}
