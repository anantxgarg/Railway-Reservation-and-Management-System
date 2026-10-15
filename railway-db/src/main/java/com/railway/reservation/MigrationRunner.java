package com.railway.reservation;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Migration runner that executes SQL migration files in order
 * Follows naming convention: V{timestamp}__{description}.sql
 */
public class MigrationRunner {
    
    private static final String MIGRATIONS_DIR = "db/migrations";
    
    /**
     * Run all migrations in the migrations directory
     * @return number of migrations executed
     * @throws SQLException if migration execution fails
     * @throws IOException if reading migration files fails
     */
    public static int runMigrations() throws SQLException, IOException {
        File migrationsDir = new File(MIGRATIONS_DIR);
        
        if (!migrationsDir.exists() || !migrationsDir.isDirectory()) {
            System.out.println("Migrations directory not found: " + MIGRATIONS_DIR);
            return 0;
        }
        
        // Get all SQL files sorted by name (timestamp ensures correct order)
        List<File> migrationFiles = Arrays.stream(migrationsDir.listFiles())
            .filter(f -> f.isFile() && f.getName().endsWith(".sql"))
            .sorted((f1, f2) -> f1.getName().compareTo(f2.getName()))
            .collect(Collectors.toList());
        
        if (migrationFiles.isEmpty()) {
            System.out.println("No migration files found");
            return 0;
        }
        
        int executedCount = 0;
        try (Connection conn = DatabaseConnection.getConnection()) {
            conn.setAutoCommit(false); // Use transactions
            
            for (File migrationFile : migrationFiles) {
                System.out.println("Running migration: " + migrationFile.getName());
                
                try {
                    String sql = readFile(migrationFile);
                    executeSql(conn, sql);
                    conn.commit();
                    executedCount++;
                    System.out.println("  ✓ Success");
                } catch (SQLException e) {
                    conn.rollback();
                    throw new SQLException("Migration failed: " + migrationFile.getName(), e);
                }
            }
        }
        
        return executedCount;
    }
    
    /**
     * Run a specific migration file
     * @param filename migration file name
     * @throws SQLException if execution fails
     * @throws IOException if reading file fails
     */
    public static void runMigration(String filename) throws SQLException, IOException {
        File migrationFile = new File(MIGRATIONS_DIR, filename);
        
        if (!migrationFile.exists()) {
            throw new IOException("Migration file not found: " + filename);
        }
        
        System.out.println("Running migration: " + filename);
        String sql = readFile(migrationFile);
        
        try (Connection conn = DatabaseConnection.getConnection()) {
            conn.setAutoCommit(false);
            try {
                executeSql(conn, sql);
                conn.commit();
                System.out.println("  ✓ Success");
            } catch (SQLException e) {
                conn.rollback();
                throw e;
            }
        }
    }
    
    /**
     * Execute SQL statements (handles multiple statements separated by semicolons)
     * @param conn database connection
     * @param sql SQL to execute
     * @throws SQLException if execution fails
     */
    private static void executeSql(Connection conn, String sql) throws SQLException {
        try (Statement stmt = conn.createStatement()) {
            // Execute entire SQL script
            stmt.execute(sql);
        }
    }
    
    /**
     * Read entire file content
     * @param file file to read
     * @return file content as string
     * @throws IOException if reading fails
     */
    private static String readFile(File file) throws IOException {
        StringBuilder content = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            while ((line = reader.readLine()) != null) {
                content.append(line).append("\n");
            }
        }
        return content.toString();
    }
    
    /**
     * Main method to run migrations from command line
     * @param args command line arguments (optional: specific migration filename)
     */
    public static void main(String[] args) {
        System.out.println("=== Railway Reservation Database Migration Runner ===");
        System.out.println(DatabaseConnection.getConnectionInfo());
        System.out.println();
        
        // Test connection first
        if (!DatabaseConnection.testConnection()) {
            System.err.println("Failed to connect to database. Check configuration.");
            System.exit(1);
        }
        
        System.out.println("Database connection successful");
        System.out.println();
        
        try {
            int count;
            if (args.length > 0) {
                // Run specific migration
                runMigration(args[0]);
                count = 1;
            } else {
                // Run all migrations
                count = runMigrations();
            }
            
            System.out.println();
            System.out.println("=== Migration Complete ===");
            System.out.println("Executed " + count + " migration(s) successfully");
            
        } catch (SQLException | IOException e) {
            System.err.println();
            System.err.println("=== Migration Failed ===");
            System.err.println("Error: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
