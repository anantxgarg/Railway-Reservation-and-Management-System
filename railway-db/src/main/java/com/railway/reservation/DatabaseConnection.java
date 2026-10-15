package com.railway.reservation;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.util.Properties;

/**
 * Database connection utility class
 * Manages PostgreSQL database connections using environment variables or properties
 */
public class DatabaseConnection {
    
    private static final String DB_HOST = getEnvOrDefault("DB_HOST", "localhost");
    private static final String DB_PORT = getEnvOrDefault("DB_PORT", "5432");
    private static final String DB_NAME = getEnvOrDefault("DB_NAME", "railway_reservation");
    private static final String DB_USER = getEnvOrDefault("DB_USER", "postgres");
    private static final String DB_PASSWORD = getEnvOrDefault("DB_PASSWORD", "postgres");
    
    private static final String DB_URL = String.format("jdbc:postgresql://%s:%s/%s", 
        DB_HOST, DB_PORT, DB_NAME);
    
    /**
     * Get a database connection
     * @return Connection object
     * @throws SQLException if connection fails
     */
    public static Connection getConnection() throws SQLException {
        try {
            // Load PostgreSQL JDBC driver
            Class.forName("org.postgresql.Driver");
        } catch (ClassNotFoundException e) {
            throw new SQLException("PostgreSQL JDBC Driver not found", e);
        }
        
        Properties props = new Properties();
        props.setProperty("user", DB_USER);
        props.setProperty("password", DB_PASSWORD);
        
        return DriverManager.getConnection(DB_URL, props);
    }
    
    /**
     * Test database connection
     * @return true if connection successful, false otherwise
     */
    public static boolean testConnection() {
        try (Connection conn = getConnection()) {
            return conn != null && !conn.isClosed();
        } catch (SQLException e) {
            System.err.println("Database connection failed: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Get database connection information (without password)
     * @return connection info string
     */
    public static String getConnectionInfo() {
        return String.format("Database: %s@%s:%s/%s", DB_USER, DB_HOST, DB_PORT, DB_NAME);
    }
    
    /**
     * Helper method to get environment variable or default value
     * @param key environment variable name
     * @param defaultValue default value if not set
     * @return value from environment or default
     */
    private static String getEnvOrDefault(String key, String defaultValue) {
        String value = System.getenv(key);
        return (value != null && !value.isEmpty()) ? value : defaultValue;
    }
}
