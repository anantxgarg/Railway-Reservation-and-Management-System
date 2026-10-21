package com.example.gateway.service;

import com.example.gateway.repo.PaymentRepository;
import com.example.gateway.repo.RefundRepository;
import com.example.gateway.repo.ReservationRepository;
import com.razorpay.RazorpayClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** The refund windows, measured from the start of the departure day in India. */
@ExtendWith(MockitoExtension.class)
class RefundPolicyTest {

    private static final LocalDate DEPARTURE_DAY = LocalDate.of(2026, 12, 10);
    private static final Instant DEPARTURE = DEPARTURE_DAY.atStartOfDay(RefundService.RAILWAY_ZONE).toInstant();

    @Mock
    private RazorpayClient razorpayClient;
    @Mock
    private ReservationRepository reservationRepo;
    @Mock
    private PaymentRepository paymentRepo;
    @Mock
    private RefundRepository refundRepo;

    private RefundService refundService;

    @BeforeEach
    void setUp() {
        refundService = new RefundService(razorpayClient, reservationRepo, paymentRepo, refundRepo);
        ReflectionTestUtils.setField(refundService, "fullWindowHours", 48L);
        ReflectionTestUtils.setField(refundService, "fullWindowPercent", BigDecimal.valueOf(90));
        ReflectionTestUtils.setField(refundService, "midWindowHours", 24L);
        ReflectionTestUtils.setField(refundService, "midWindowPercent", BigDecimal.valueOf(75));
        ReflectionTestUtils.setField(refundService, "lateWindowHours", 4L);
        ReflectionTestUtils.setField(refundService, "lateWindowPercent", BigDecimal.valueOf(50));
    }

    private BigDecimal percentHoursBefore(long hours) {
        return refundService.policyFor(DEPARTURE_DAY, DEPARTURE.minusSeconds(hours * 3600)).percent();
    }

    @Test
    void testRefundAbove48Hours() {
        assertEquals(BigDecimal.valueOf(90), percentHoursBefore(52));
        assertEquals(BigDecimal.valueOf(90), percentHoursBefore(48));
    }

    @Test
    void testRefundBetween24And48Hours() {
        assertEquals(BigDecimal.valueOf(75), percentHoursBefore(30));
    }

    @Test
    void testRefundBetween4And24Hours() {
        assertEquals(BigDecimal.valueOf(50), percentHoursBefore(12));
    }

    @Test
    void testRefundUnder4Hours() {
        assertEquals(BigDecimal.ZERO, percentHoursBefore(2));
        assertEquals(BigDecimal.ZERO, percentHoursBefore(-5));
    }

    @Test
    void departureIsTheStartOfTheDayInIndiaNotUtc() {
        // 10:00 IST the day before departure is 14 hours before midnight IST
        Instant dayBefore10am = DEPARTURE_DAY.minusDays(1).atTime(10, 0)
                .atZone(RefundService.RAILWAY_ZONE).toInstant();
        assertEquals(BigDecimal.valueOf(50), refundService.policyFor(DEPARTURE_DAY, dayBefore10am).percent());
    }
}
