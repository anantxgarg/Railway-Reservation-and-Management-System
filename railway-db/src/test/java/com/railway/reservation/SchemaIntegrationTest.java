package com.railway.reservation;

import org.junit.jupiter.api.*;
import java.sql.*;
import java.time.LocalDate;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for Railway Reservation System database schema
 * Tests referential integrity, constraints, and core business logic
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SchemaIntegrationTest {
    
    private Connection connection;
    private static final String TEST_PNR = "TEST123456";
    
    @BeforeAll
    public void setup() throws Exception {
        // Get database connection
        Properties props = new Properties();
        props.setProperty("user", System.getenv().getOrDefault("DB_USER", "postgres"));
        props.setProperty("password", System.getenv().getOrDefault("DB_PASSWORD", "postgres"));
        
        String dbHost = System.getenv().getOrDefault("DB_HOST", "localhost");
        String dbPort = System.getenv().getOrDefault("DB_PORT", "5432");
        String dbName = System.getenv().getOrDefault("DB_NAME", "railway_reservation");
        
        String url = String.format("jdbc:postgresql://%s:%s/%s", dbHost, dbPort, dbName);
        connection = DriverManager.getConnection(url, props);
        connection.setAutoCommit(false); // Use transactions for test isolation
    }
    
    @AfterAll
    public void teardown() throws Exception {
        if (connection != null && !connection.isClosed()) {
            connection.close();
        }
    }
    
    @AfterEach
    public void rollbackTransaction() throws Exception {
        if (connection != null) {
            connection.rollback(); // Roll back each test to keep database clean
        }
    }
    
    // ============================================
    // Test 1: All Tables Exist
    // ============================================
    @Test
    @Order(1)
    public void testAllTablesExist() throws Exception {
        String[] expectedTables = {
            "roles", "permissions", "role_permissions", "users", "staff",
            "station", "train", "travel_class", "route", "route_station",
            "train_schedule", "train_run", "train_coach", "seat",
            "quota", "concession_rule",
            "booking", "passenger", "seat_allocation",
            "payment", "payment_transaction", "refund"
        };
        
        DatabaseMetaData metaData = connection.getMetaData();
        for (String table : expectedTables) {
            ResultSet rs = metaData.getTables(null, "public", table, new String[]{"TABLE"});
            assertTrue(rs.next(), "Table '" + table + "' should exist");
            rs.close();
        }
    }
    
    // ============================================
    // Test 2: Seed Data Loaded
    // ============================================
    @Test
    @Order(2)
    public void testSeedDataLoaded() throws Exception {
        // Check roles
        try (Statement stmt = connection.createStatement()) {
            ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM roles");
            rs.next();
            assertEquals(3, rs.getInt(1), "Should have 3 roles");
        }
        
        // Check permissions
        try (Statement stmt = connection.createStatement()) {
            ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM permissions");
            rs.next();
            assertTrue(rs.getInt(1) >= 10, "Should have at least 10 permissions");
        }
        
        // Check stations
        try (Statement stmt = connection.createStatement()) {
            ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM station");
            rs.next();
            assertTrue(rs.getInt(1) >= 5, "Should have at least 5 stations");
        }
        
        // Check trains
        try (Statement stmt = connection.createStatement()) {
            ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM train");
            rs.next();
            assertTrue(rs.getInt(1) >= 2, "Should have at least 2 trains");
        }
        
        // Check users
        try (Statement stmt = connection.createStatement()) {
            ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM users");
            rs.next();
            assertEquals(3, rs.getInt(1), "Should have 3 test users");
        }
    }
    
    // ============================================
    // Test 3: Foreign Key Integrity
    // ============================================
    @Test
    @Order(3)
    public void testForeignKeyIntegrity() throws Exception {
        // Try to insert a user with invalid role_id
        assertThrows(SQLException.class, () -> {
            try (PreparedStatement pstmt = connection.prepareStatement(
                "INSERT INTO users (role_id, email, password_hash, name, status) " +
                "VALUES (999, 'invalid@test.com', 'hash', 'Invalid User', 'ACTIVE')")) {
                pstmt.executeUpdate();
            }
        }, "Should reject invalid foreign key");
    }
    
    // ============================================
    // Test 4: Unique Constraints
    // ============================================
    @Test
    @Order(4)
    public void testUniqueConstraints() throws Exception {
        // Try to insert duplicate email
        assertThrows(SQLException.class, () -> {
            try (PreparedStatement pstmt = connection.prepareStatement(
                "INSERT INTO users (role_id, email, password_hash, name, status) " +
                "SELECT role_id, 'customer@test.com', 'hash', 'Duplicate', 'ACTIVE' FROM roles WHERE role_name = 'CUSTOMER'")) {
                pstmt.executeUpdate();
            }
        }, "Should reject duplicate email");
    }
    
    // ============================================
    // Test 5: CHECK Constraints
    // ============================================
    @Test
    @Order(5)
    public void testCheckConstraints() throws Exception {
        // Test invalid email format
        assertThrows(SQLException.class, () -> {
            try (PreparedStatement pstmt = connection.prepareStatement(
                "INSERT INTO users (role_id, email, password_hash, name, status) " +
                "SELECT role_id, 'invalid-email', 'hash', 'Test', 'ACTIVE' FROM roles WHERE role_name = 'CUSTOMER'")) {
                pstmt.executeUpdate();
            }
        }, "Should reject invalid email format");
        
        // Test negative base fare
        assertThrows(SQLException.class, () -> {
            try (PreparedStatement pstmt = connection.prepareStatement(
                "INSERT INTO travel_class (class_code, class_name, is_ac, seats_per_coach, base_fare_per_km, reservation_charge) " +
                "VALUES ('XX', 'Invalid', false, 50, -1.0, 10.0)")) {
                pstmt.executeUpdate();
            }
        }, "Should reject negative base fare");
    }
    
    // ============================================
    // Test 6: Full Booking Flow
    // ============================================
    @Test
    @Order(6)
    public void testFullBookingFlow() throws Exception {
        // Get test data
        int userId, runId, seatId;
        try (Statement stmt = connection.createStatement()) {
            ResultSet rs = stmt.executeQuery(
                "SELECT user_id FROM users WHERE email = 'customer@test.com'");
            rs.next();
            userId = rs.getInt("user_id");
            
            rs = stmt.executeQuery(
                "SELECT run_id FROM train_run LIMIT 1");
            rs.next();
            runId = rs.getInt("run_id");
            
            rs = stmt.executeQuery(
                "SELECT seat_id FROM seat LIMIT 1");
            rs.next();
            seatId = rs.getInt("seat_id");
        }
        
        // 1. Create booking
        try (PreparedStatement pstmt = connection.prepareStatement(
            "INSERT INTO booking (pnr, user_id, run_id, class_code, quota_code, from_seq, to_seq, total_fare, status, hold_expires_at) " +
            "VALUES (?, ?, ?, '2A', 'GN', 1, 2, 500.00, 'HELD', NOW() + INTERVAL '15 minutes')")) {
            pstmt.setString(1, TEST_PNR);
            pstmt.setInt(2, userId);
            pstmt.setInt(3, runId);
            pstmt.executeUpdate();
        }
        
        // 2. Add passenger
        int passengerId;
        try (PreparedStatement pstmt = connection.prepareStatement(
            "INSERT INTO passenger (pnr, name, age, gender, status, passenger_fare) " +
            "VALUES (?, 'Test Passenger', 30, 'M', 'CONFIRMED', 500.00) RETURNING passenger_id")) {
            pstmt.setString(1, TEST_PNR);
            ResultSet rs = pstmt.executeQuery();
            rs.next();
            passengerId = rs.getInt("passenger_id");
        }
        
        // 3. Allocate seat
        try (PreparedStatement pstmt = connection.prepareStatement(
            "INSERT INTO seat_allocation (passenger_id, seat_id, run_id, from_seq, to_seq) " +
            "VALUES (?, ?, ?, 1, 2)")) {
            pstmt.setInt(1, passengerId);
            pstmt.setInt(2, seatId);
            pstmt.setInt(3, runId);
            pstmt.executeUpdate();
        }
        
        // 4. Create payment
        int paymentId;
        try (PreparedStatement pstmt = connection.prepareStatement(
            "INSERT INTO payment (pnr, amount, currency, provider, order_id, status) " +
            "VALUES (?, 500.00, 'INR', 'RAZORPAY', ?, 'CREATED') RETURNING payment_id")) {
            pstmt.setString(1, TEST_PNR);
            pstmt.setString(2, "ORDER_" + System.currentTimeMillis());
            ResultSet rs = pstmt.executeQuery();
            rs.next();
            paymentId = rs.getInt("payment_id");
        }
        
        // 5. Create payment transaction
        int transactionId;
        try (PreparedStatement pstmt = connection.prepareStatement(
            "INSERT INTO payment_transaction (payment_id, amount, status) " +
            "VALUES (?, 500.00, 'SUCCESS') RETURNING transaction_id")) {
            pstmt.setInt(1, paymentId);
            ResultSet rs = pstmt.executeQuery();
            rs.next();
            transactionId = rs.getInt("transaction_id");
        }
        
        // 6. Update payment and booking status
        try (PreparedStatement pstmt = connection.prepareStatement(
            "UPDATE payment SET status = 'SUCCESS', method = 'UPI', paid_at = NOW() WHERE payment_id = ?")) {
            pstmt.setInt(1, paymentId);
            pstmt.executeUpdate();
        }
        
        try (PreparedStatement pstmt = connection.prepareStatement(
            "UPDATE booking SET status = 'CONFIRMED' WHERE pnr = ?")) {
            pstmt.setString(1, TEST_PNR);
            pstmt.executeUpdate();
        }
        
        // Verify the booking
        try (PreparedStatement pstmt = connection.prepareStatement(
            "SELECT status FROM booking WHERE pnr = ?")) {
            pstmt.setString(1, TEST_PNR);
            ResultSet rs = pstmt.executeQuery();
            assertTrue(rs.next());
            assertEquals("CONFIRMED", rs.getString("status"));
        }
    }
    
    // ============================================
    // Test 7: Cascading Deletes
    // ============================================
    @Test
    @Order(7)
    public void testCascadingDeletes() throws Exception {
        // Get a role with permissions
        int roleId;
        try (Statement stmt = connection.createStatement()) {
            ResultSet rs = stmt.executeQuery(
                "SELECT role_id FROM roles WHERE role_name = 'CUSTOMER'");
            rs.next();
            roleId = rs.getInt("role_id");
        }
        
        // Count role_permissions before delete
        int countBefore;
        try (PreparedStatement pstmt = connection.prepareStatement(
            "SELECT COUNT(*) FROM role_permissions WHERE role_id = ?")) {
            pstmt.setInt(1, roleId);
            ResultSet rs = pstmt.executeQuery();
            rs.next();
            countBefore = rs.getInt(1);
        }
        
        assertTrue(countBefore > 0, "Should have permissions assigned to CUSTOMER role");
        
        // This would CASCADE delete role_permissions (but will fail due to users FK RESTRICT)
        // So let's test with a fresh role
        int testRoleId;
        try (PreparedStatement pstmt = connection.prepareStatement(
            "INSERT INTO roles (role_name, description) VALUES ('ADMIN'::role_name_enum, 'Test role') RETURNING role_id")) {
            ResultSet rs = pstmt.executeQuery();
            rs.next();
            testRoleId = rs.getInt("role_id");
        }
        
        // Add a permission to it
        try (PreparedStatement pstmt = connection.prepareStatement(
            "INSERT INTO role_permissions (role_id, permission_id) " +
            "SELECT ?, permission_id FROM permissions LIMIT 1")) {
            pstmt.setInt(1, testRoleId);
            pstmt.executeUpdate();
        }
        
        // Delete the role - should CASCADE to role_permissions
        try (PreparedStatement pstmt = connection.prepareStatement(
            "DELETE FROM roles WHERE role_id = ?")) {
            pstmt.setInt(1, testRoleId);
            pstmt.executeUpdate();
        }
        
        // Verify role_permissions was deleted
        try (PreparedStatement pstmt = connection.prepareStatement(
            "SELECT COUNT(*) FROM role_permissions WHERE role_id = ?")) {
            pstmt.setInt(1, testRoleId);
            ResultSet rs = pstmt.executeQuery();
            rs.next();
            assertEquals(0, rs.getInt(1), "role_permissions should be cascaded deleted");
        }
    }
    
    // ============================================
    // Test 8: Passenger Limit (Max 6 per booking)
    // ============================================
    @Test
    @Order(8)
    public void testPassengerLimit() throws Exception {
        // This test is informational - the constraint will be enforced in Phase 2
        System.out.println("Note: Max 6 passengers per PNR constraint should be added in Phase 2");
    }
    
    // ============================================
    // Test 9: Enum Values
    // ============================================
    @Test
    @Order(9)
    public void testEnumValues() throws Exception {
        // Test valid enum value
        try (PreparedStatement pstmt = connection.prepareStatement(
            "SELECT role_id FROM roles WHERE role_name = 'CUSTOMER'")) {
            ResultSet rs = pstmt.executeQuery();
            assertTrue(rs.next(), "CUSTOMER role should exist");
        }
        
        // Test invalid enum value - should fail at compile/runtime
        assertThrows(SQLException.class, () -> {
            try (Statement stmt = connection.createStatement()) {
                stmt.executeQuery("SELECT 'INVALID_ROLE'::role_name_enum");
            }
        }, "Should reject invalid enum value");
    }
    
    // ============================================
    // Test 10: Trigger Functionality
    // ============================================
    @Test
    @Order(10)
    public void testTriggers() throws Exception {
        // Test auto-update timestamp trigger on users
        int userId;
        Timestamp createdAt, updatedAt1, updatedAt2;
        
        // Create a test user
        try (PreparedStatement pstmt = connection.prepareStatement(
            "INSERT INTO users (role_id, email, password_hash, name, status) " +
            "SELECT role_id, 'trigger_test@test.com', 'hash', 'Trigger Test', 'ACTIVE' " +
            "FROM roles WHERE role_name = 'CUSTOMER' RETURNING user_id, created_at, updated_at")) {
            ResultSet rs = pstmt.executeQuery();
            rs.next();
            userId = rs.getInt("user_id");
            createdAt = rs.getTimestamp("created_at");
            updatedAt1 = rs.getTimestamp("updated_at");
        }
        
        assertNotNull(createdAt);
        assertNotNull(updatedAt1);
        
        // Wait a moment
        Thread.sleep(100);
        
        // Update the user
        try (PreparedStatement pstmt = connection.prepareStatement(
            "UPDATE users SET name = 'Updated Name' WHERE user_id = ?")) {
            pstmt.setInt(1, userId);
            pstmt.executeUpdate();
        }
        
        // Check that updated_at changed
        try (PreparedStatement pstmt = connection.prepareStatement(
            "SELECT updated_at FROM users WHERE user_id = ?")) {
            pstmt.setInt(1, userId);
            ResultSet rs = pstmt.executeQuery();
            rs.next();
            updatedAt2 = rs.getTimestamp("updated_at");
        }
        
        assertTrue(updatedAt2.after(updatedAt1), "updated_at should be automatically updated");
    }
}
