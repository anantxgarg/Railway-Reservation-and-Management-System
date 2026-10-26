# C2-Network Database Module (Neon PostgreSQL)

This directory houses the foundational database infrastructure for the **C2-Network** railway management microservice. The database is hosted on **Neon PostgreSQL** and is architected using a normalized relational model designed to handle network topology, scheduling, operational runs, and rolling stock configuration.

---

## **1. Architecture & Technology Stack**
* **Database Engine:** PostgreSQL (Managed via Neon Cloud)
* **Design Paradigm:** Relational, Third Normal Form (3NF) core schema with strict foreign key referential integrity, domain constraints (`CHECK`), and high-performance indexing.
* **Environment Configuration:** Securely decoupled from application code via environment variables.

---

## **2. Core Schema Entities (Table Overview)**

The database consists of **7 core relational tables** organized into master lookup tables, operational configurations, and schedule instances:

| Table Name | Entity Type | Description | Primary Key |
| :--- | :--- | :--- | :--- |
| `travel_class` | Master Lookup | Defines coach accommodation types (`1A`, `2A`, `3A`, `SL`, `CC`), seat capacities, and fare rules. | `class_code` |
| `station` | Master Lookup | Comprehensive directory of railway stations, junction codes, and station names. | `station_code` |
| `train` | Master Lookup | Core register of trains operating across the network, including active flags. | `train_no` |
| `route_station` | Relational / Topology | Maps trains to sequential route stops, arrival/departure times, and cumulative distances. | (`train_no`, `stop_seq`) |
| `train_coach` | Relational / Rolling Stock | Specifies the physical coach composition mapped to specific trains and classes. | (`train_no`, `coach_no`) |
| `train_schedule` | Relational / Rules | Configures recurring weekly operating days (`MON` through `SUN`) for each train. | (`train_no`, `run_day`) |
| `train_run` | Operational Instance | Tracks specific calendar dates, rolling-window states (`SCHEDULED`, `DELAYED`, `CANCELLED`), and run IDs. | `run_id` (Auto ID) |

---

## **3. Script Execution Order**

To set up a fresh instance of the database (e.g., in a local development environment or CI pipeline), execute the SQL scripts in the following strict dependency sequence:

1. **`schema.sql`** — Drops/Creates tables, constraints, check validations, and indexes.
   ```bash
   psql -h <neon-host> -U <username> -d neondb -f schema.sql