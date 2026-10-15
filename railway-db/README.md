# Railway Reservation Database 🚂

Complete PostgreSQL database implementation for a Railway Reservation and Management System.

## 📋 Overview

This module provides a production-ready relational database with:
- **22 tables** across 5 modules (Identity, Trains, Fares, Booking, Payments)
- **12 enum types** for type safety
- **22 foreign key constraints** for referential integrity
- **40+ indexes** for optimal performance
- **Comprehensive seed data** with 1,756 seats, 30 train runs, and test users

## ✨ Features

### Modules Implemented

1. **Identity & Access** (5 tables)
   - Role-based access control (RBAC)
   - User authentication
   - Staff management

2. **Trains, Stations & Routes** (9 tables)
   - Railway network infrastructure
   - Train schedules and runs
   - Seat inventory

3. **Fares** (2 tables)
   - Quota-based pricing
   - Passenger concessions

4. **Booking** (3 tables)
   - PNR management
   - Passenger details (up to 6 per booking)
   - Seat allocation

5. **Payments & Refunds** (3 tables)
   - Payment gateway integration (Razorpay)
   - Transaction retry handling
   - Per-passenger refunds

## 🚀 Quick Start

### Prerequisites

- PostgreSQL 16+
- Java 21+
- Maven 3.8+

### Installation

1. **Create Database**
   ```bash
   sudo -u postgres psql -c "CREATE DATABASE railway_reservation;"
   ```

2. **Apply Migrations**
   ```bash
   cd railway-db
   for migration in db/migrations/V*.sql; do
       sudo -u postgres psql -d railway_reservation -f "$migration"
   done
   ```

3. **Verify Installation**
   ```bash
   ./test_database.sh
   ```

### Environment Variables

Create a `.env` file (see `.env.example`):
```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=railway_reservation
DB_USER=postgres
DB_PASSWORD=your_password
```

## 🧪 Testing

### Run Database Tests
```bash
./test_database.sh
```

### Run Integration Tests
```bash
mvn test
```

### Maven Commands
```bash
# Compile
mvn clean compile

# Run tests
mvn test

# Package
mvn package

# Run migration runner
mvn exec:java -Dexec.mainClass="com.railway.reservation.MigrationRunner"
```

## 📊 Database Schema

### Tables by Module

| Module | Tables | Description |
|--------|--------|-------------|
| Identity & Access | 5 | roles, permissions, role_permissions, users, staff |
| Trains/Stations/Routes | 9 | station, train, travel_class, route, route_station, train_schedule, train_run, train_coach, seat |
| Fares | 2 | quota, concession_rule |
| Booking | 3 | booking, passenger, seat_allocation |
| Payments & Refunds | 3 | payment, payment_transaction, refund |

### Migrations

```
db/migrations/
├── V20250101_0001__extensions_and_enums.sql       # Extensions and 12 enum types
├── V20250101_0002__identity_and_access.sql        # User management and RBAC
├── V20250101_0003__trains_stations_routes.sql     # Railway network
├── V20250101_0004__fares.sql                      # Pricing rules
├── V20250101_0005__booking.sql                    # Reservation system
├── V20250101_0006__payments_and_refunds.sql       # Payment processing
└── V20250101_0007__seed_data.sql                  # Reference and test data
```

## 📦 Seed Data

The database comes pre-loaded with:
- **3 roles** (CUSTOMER, STAFF, ADMIN) with 15 permissions
- **5 travel classes** (1A, 2A, 3A, SL, 2S)
- **4 quotas** (General, Tatkal, Ladies, Senior)
- **3 concession rules** (Senior Citizen, Child, Disabled)
- **10 major stations** across India
- **3 trains** with realistic routes
- **24 coaches** with **1,756 seats**
- **30 train runs** for the next 10 days
- **3 test users** (customer, staff, admin)

### Test Users

| Email | Password Hash | Role | Purpose |
|-------|---------------|------|---------|
| customer@test.com | (bcrypt hash) | CUSTOMER | Regular user testing |
| staff@railway.com | (bcrypt hash) | STAFF | Staff operations testing |
| admin@railway.com | (bcrypt hash) | ADMIN | Admin panel testing |

## 🔍 Database Operations

### Common Queries

```sql
-- List all tables
\dt

-- Count records
SELECT COUNT(*) FROM seat;      -- 1,756 seats
SELECT COUNT(*) FROM train_run; -- 30 runs

-- View booking flow
SELECT b.pnr, b.status, p.name, p.status as passenger_status
FROM booking b
JOIN passenger p ON b.pnr = p.pnr;

-- Check seat availability
SELECT t.train_no, tc.coach_no, COUNT(s.seat_id) as seat_count
FROM train t
JOIN train_coach tc ON t.train_no = tc.train_no
JOIN seat s ON tc.train_no = s.train_no AND tc.coach_no = s.coach_no
GROUP BY t.train_no, tc.coach_no;
```

### Reset Database

```bash
sudo -u postgres psql -c "DROP DATABASE IF EXISTS railway_reservation;"
sudo -u postgres psql -c "CREATE DATABASE railway_reservation;"

# Reapply migrations
for migration in db/migrations/V*.sql; do
    sudo -u postgres psql -d railway_reservation -f "$migration"
done
```

## 📖 Documentation

- **[Implementation Guide](docs/IMPLEMENTATION_COMPLETE.md)** - Complete technical documentation
- **[Schema Specification](../schema_info/SCHEMA.MD)** - Master schema reference
- **[Handover Document](../llm/HANDOVER.md)** - Project status and history

## 🏗️ Project Structure

```
railway-db/
├── db/
│   └── migrations/              # Sequential SQL migrations
├── docs/
│   └── IMPLEMENTATION_COMPLETE.md
├── src/
│   ├── main/java/com/railway/reservation/
│   │   ├── App.java
│   │   ├── DatabaseConnection.java
│   │   └── MigrationRunner.java
│   └── test/java/com/railway/reservation/
│       ├── AppTest.java
│       └── SchemaIntegrationTest.java
├── .env.example
├── .gitignore
├── pom.xml
├── README.md
└── test_database.sh
```

## 🔐 Security Considerations

- Password hashes use BCrypt (sample hashes in seed data)
- Email validation at database level
- Foreign key constraints prevent orphaned records
- CHECK constraints enforce business rules
- Enum types prevent invalid status values

## 🚀 Performance

- **40+ indexes** on frequently queried columns
- Composite indexes for join optimization
- Partial indexes for filtered queries
- Foreign key indexes for referential integrity

## 🛠️ Development

### Adding New Migrations

Create a new file: `V{timestamp}__{description}.sql`

```sql
-- Migration: V20250102_0001__add_new_feature.sql
-- Description: Add new feature

-- Your SQL here

-- Rollback (optional)
-- DROP TABLE IF EXISTS new_table;
```

### Database Connection

```java
Connection conn = DatabaseConnection.getConnection();
// Use connection
conn.close();
```

## 📈 Statistics

```
Total Tables:           22
Foreign Keys:           22
CHECK Constraints:      30+
Indexes:                40+
Enum Types:             12
Triggers:               2

Seed Data:
- Stations:             10
- Trains:               3
- Routes:               3
- Train Runs:           30
- Coaches:              24
- Seats:                1,756
- Users:                3
```

## 🔮 Future Enhancements (Phase 2)

- [ ] Exclusion constraints for seat overlap prevention
- [ ] Stored procedures for booking operations
- [ ] Views for complex queries
- [ ] Materialized views for reporting
- [ ] Automatic waitlist promotion
- [ ] Dynamic pricing engine

## 🤝 Contributing

This database is part of a larger Railway Reservation System project. For contributions:

1. Create migrations for schema changes
2. Update seed data if needed
3. Add tests for new features
4. Update documentation

## 📝 License

See LICENSE file in the repository root.

## 🆘 Troubleshooting

### Connection Issues
```bash
# Check PostgreSQL status
systemctl status postgresql

# Test connection
psql -U postgres -d railway_reservation -c "SELECT version();"
```

### Migration Errors
```bash
# Check applied migrations
SELECT * FROM information_schema.tables WHERE table_schema = 'public';

# Reset and reapply
./reset_database.sh
```

### Test Failures
```bash
# Check database connectivity
mvn test -Dtest=SchemaIntegrationTest#testAllTablesExist

# View detailed logs
mvn test -X
```

## 📞 Support

For issues or questions:
- Check the [Implementation Guide](docs/IMPLEMENTATION_COMPLETE.md)
- Review the [Schema Specification](../schema_info/SCHEMA.MD)
- See [Handover Document](../llm/HANDOVER.md) for project history

---

**Status:** ✅ Production Ready  
**Version:** 1.0.0  
**Last Updated:** October 9, 2026

**Built with ❤️ for the Indian Railways**
