package com.example.gateway.service;

import com.example.gateway.domain.ConcessionApplication;
import com.example.gateway.domain.ConcessionStatus;
import com.example.gateway.domain.PassengerCategory;
import com.example.gateway.repo.ConcessionApplicationRepository;
import com.example.gateway.web.ApiException;
import com.example.gateway.web.Dtos.ConcessionResult;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Concession calculation, document tracking, and staff verification service.
 */
@Service
public class ConcessionService {

    private final ConcessionApplicationRepository concessionRepo;
    private final Map<PassengerCategory, BigDecimal> rates = new EnumMap<>(PassengerCategory.class);

    public ConcessionService(
            ConcessionApplicationRepository concessionRepo,
            @Value("${concession.general:0}") BigDecimal general,
            @Value("${concession.senior-citizen:0}") BigDecimal seniorCitizen,
            @Value("${concession.student:0}") BigDecimal student,
            @Value("${concession.child:0}") BigDecimal child,
            @Value("${concession.differently-abled:0}") BigDecimal differentlyAbled,
            @Value("${concession.armed-forces:0}") BigDecimal armedForces) {
        this.concessionRepo = concessionRepo;
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

    @Transactional
    public ConcessionApplication createApplication(
            Long bookingId, Integer userId, String passengerName,
            PassengerCategory category, BigDecimal baseFare,
            String idCardType, String idCardNumber, String documentUrl) {
        ConcessionResult result = calculate(category, baseFare);

        ConcessionApplication app = new ConcessionApplication();
        app.setBookingId(bookingId);
        app.setUserId(userId);
        app.setPassengerName(passengerName);
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
        app.setUpdatedAt(LocalDateTime.now());
        return concessionRepo.save(app);
    }

    public List<ConcessionApplication> getPendingApplications() {
        return concessionRepo.findByStatusOrderByIdDesc(ConcessionStatus.PENDING);
    }

    public List<ConcessionApplication> getForUser(Integer userId) {
        return concessionRepo.findByUserIdOrderByIdDesc(userId);
    }

    public ConcessionApplication getByBooking(Long bookingId) {
        return concessionRepo.findByBookingId(bookingId)
                .orElseThrow(() -> ApiException.notFound("No concession application for booking " + bookingId));
    }
}
