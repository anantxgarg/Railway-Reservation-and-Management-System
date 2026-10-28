package com.example.gateway.service;

import com.example.gateway.domain.ConcessionApplication;
import com.example.gateway.domain.ConcessionStatus;
import com.example.gateway.repo.ConcessionApplicationRepository;
import com.example.gateway.repo.ConcessionRuleRepository;
import com.example.gateway.repo.ConcessionRuleRepository.PassengerConcession;
import com.example.gateway.repo.ConcessionRuleRepository.Rule;
import com.example.gateway.repo.ReservationRepository;
import com.example.gateway.repo.ReservationRepository.PassengerInfo;
import com.example.gateway.web.ApiException;
import com.example.gateway.web.Dtos.ConcessionResult;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * Concessions: the discounts, document tracking and staff verification.
 *
 * The concessions and their discounts are the rows of the shared
 * concession_rule table. A passenger gets one when booked (Team 3's
 * create_booking applies it to the fare); the customer then sends the
 * documents for it here, and staff approve or reject them.
 */
@Service
@RequiredArgsConstructor
public class ConcessionService {

    /** No concession; the preview's default. */
    public static final String GENERAL = "GENERAL";

    private final ConcessionApplicationRepository concessionRepo;
    private final ConcessionRuleRepository rules;
    private final ReservationRepository reservations;

    public List<Rule> rules() {
        return rules.active();
    }

    public ConcessionResult calculate(String category, BigDecimal baseFare) {
        if (category == null || category.isBlank() || GENERAL.equals(category)) {
            return new ConcessionResult(GENERAL, baseFare, BigDecimal.ZERO, BigDecimal.ZERO.setScale(2), baseFare);
        }
        Rule rule = rules.byCategory(category)
                .orElseThrow(() -> ApiException.badRequest("Unknown concession: " + category));
        BigDecimal discount = rule.isPercentage()
                ? Money.percentOf(baseFare, rule.discountValue())
                : rule.discountValue().min(baseFare);
        return new ConcessionResult(rule.category(), baseFare, rule.isPercentage() ? rule.discountValue() : null,
                discount, baseFare.subtract(discount));
    }

    /**
     * Documents for the concession one passenger of a booking was booked with.
     * The passenger's name, the concession and the discount come from the
     * booking (Team 3); only the booking's owner may apply.
     */
    @Transactional
    public ConcessionApplication createApplication(
            String pnr, Integer passengerId, Integer userId, boolean isAdmin,
            String category,
            String idCardType, String idCardNumber, String documentUrl) {
        reservations.find(pnr)
                .filter(b -> isAdmin || (userId != null && b.userId() == userId))
                .orElseThrow(() -> ApiException.notFound("Booking not found: " + pnr));
        PassengerInfo passenger = reservations.passenger(pnr, passengerId)
                .orElseThrow(() -> ApiException.notFound("Passenger " + passengerId + " is not on booking " + pnr));
        PassengerConcession booked = rules.ofPassenger(passengerId)
                .orElseThrow(() -> ApiException.badRequest(passenger.name()
                        + " was booked without a concession; choose one on the booking form"));
        Rule rule = booked.rule();
        if (category != null && !category.isBlank() && !category.equals(rule.category())) {
            throw ApiException.badRequest(passenger.name() + " was booked with the " + rule.name()
                    + " concession, not " + category);
        }
        if (concessionRepo.existsByPassengerIdAndStatusNot(passengerId, ConcessionStatus.REJECTED)) {
            throw ApiException.conflict("Documents for " + passenger.name() + " have already been sent");
        }

        ConcessionApplication app = new ConcessionApplication();
        app.setPnr(pnr);
        app.setPassengerId(passengerId);
        app.setUserId(userId);
        app.setPassengerName(passenger.name());
        app.setCategory(rule.category());
        app.setIdCardType(idCardType != null ? idCardType : "NOT_SPECIFIED");
        app.setIdCardNumber(idCardNumber != null ? idCardNumber : "NOT_SPECIFIED");
        app.setDocumentReferenceUrl(documentUrl);
        app.setDiscountPercent(rule.isPercentage() ? rule.discountValue() : null);
        app.setDiscountAmount(booked.fareWithoutConcession().subtract(booked.fare()));
        app.setStatus(ConcessionStatus.PENDING);
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
