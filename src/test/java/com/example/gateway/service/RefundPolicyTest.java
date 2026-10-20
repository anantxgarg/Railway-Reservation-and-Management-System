package com.example.gateway.service;

import com.example.gateway.domain.Booking;
import com.example.gateway.domain.BookingStatus;
import com.example.gateway.domain.Payment;
import com.example.gateway.domain.PaymentStatus;
import com.example.gateway.repo.BookingRepository;
import com.example.gateway.repo.PaymentRepository;
import com.example.gateway.repo.RefundRepository;
import com.example.gateway.web.Dtos.RefundQuote;
import com.razorpay.RazorpayClient;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RefundPolicyTest {

    @Mock
    private RazorpayClient razorpayClient;
    @Mock
    private BookingRepository bookingRepo;
    @Mock
    private PaymentRepository paymentRepo;
    @Mock
    private RefundRepository refundRepo;

    private RefundService refundService;

    @BeforeEach
    void setUp() {
        refundService = new RefundService(razorpayClient, bookingRepo, paymentRepo, refundRepo);
        ReflectionTestUtils.setField(refundService, "fullWindowHours", 48L);
        ReflectionTestUtils.setField(refundService, "fullWindowPercent", BigDecimal.valueOf(90));
        ReflectionTestUtils.setField(refundService, "midWindowHours", 24L);
        ReflectionTestUtils.setField(refundService, "midWindowPercent", BigDecimal.valueOf(75));
        ReflectionTestUtils.setField(refundService, "lateWindowHours", 4L);
        ReflectionTestUtils.setField(refundService, "lateWindowPercent", BigDecimal.valueOf(50));
    }

    private Booking createBooking(LocalDateTime departureTime) {
        Booking b = new Booking();
        b.setId(100L);
        b.setStatus(BookingStatus.CONFIRMED);
        b.setDepartureTime(departureTime);
        b.setFinalAmount(BigDecimal.valueOf(1000));
        return b;
    }

    private Payment createPayment() {
        Payment p = new Payment();
        p.setId(200L);
        p.setBookingId(100L);
        p.setStatus(PaymentStatus.PAID);
        p.setAmount(BigDecimal.valueOf(1000));
        return p;
    }

    @Test
    void testRefundAbove48Hours() {
        Booking booking = createBooking(LocalDateTime.now().plusHours(52));
        Payment payment = createPayment();

        when(bookingRepo.findById(100L)).thenReturn(Optional.of(booking));
        when(paymentRepo.findFirstByBookingIdAndStatus(100L, PaymentStatus.PAID)).thenReturn(Optional.of(payment));

        RefundQuote quote = refundService.quote(100L);
        assertEquals(BigDecimal.valueOf(90), quote.refundPercent());
        assertEquals(BigDecimal.valueOf(900.00).setScale(2), quote.refundAmount());
    }

    @Test
    void testRefundBetween24And48Hours() {
        Booking booking = createBooking(LocalDateTime.now().plusHours(30));
        Payment payment = createPayment();

        when(bookingRepo.findById(100L)).thenReturn(Optional.of(booking));
        when(paymentRepo.findFirstByBookingIdAndStatus(100L, PaymentStatus.PAID)).thenReturn(Optional.of(payment));

        RefundQuote quote = refundService.quote(100L);
        assertEquals(BigDecimal.valueOf(75), quote.refundPercent());
        assertEquals(BigDecimal.valueOf(750.00).setScale(2), quote.refundAmount());
    }

    @Test
    void testRefundBetween4And24Hours() {
        Booking booking = createBooking(LocalDateTime.now().plusHours(12));
        Payment payment = createPayment();

        when(bookingRepo.findById(100L)).thenReturn(Optional.of(booking));
        when(paymentRepo.findFirstByBookingIdAndStatus(100L, PaymentStatus.PAID)).thenReturn(Optional.of(payment));

        RefundQuote quote = refundService.quote(100L);
        assertEquals(BigDecimal.valueOf(50), quote.refundPercent());
        assertEquals(BigDecimal.valueOf(500.00).setScale(2), quote.refundAmount());
    }

    @Test
    void testRefundUnder4Hours() {
        Booking booking = createBooking(LocalDateTime.now().plusHours(2));
        Payment payment = createPayment();

        when(bookingRepo.findById(100L)).thenReturn(Optional.of(booking));
        when(paymentRepo.findFirstByBookingIdAndStatus(100L, PaymentStatus.PAID)).thenReturn(Optional.of(payment));

        RefundQuote quote = refundService.quote(100L);
        assertEquals(BigDecimal.ZERO, quote.refundPercent());
        assertEquals(BigDecimal.valueOf(0.00).setScale(2), quote.refundAmount());
    }
}
