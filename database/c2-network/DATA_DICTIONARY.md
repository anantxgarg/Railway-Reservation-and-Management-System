# C2-Network Database Dictionary

This document outlines the schema design, tables, and relationships for the `c2-network` railway microservice database.

---

## **Summary of Tables**

| # | Table Name | Description |
|---|------------|-------------|
| 1 | `travel_class` | Master lookup table defining train coach classes (e.g., 1A, 2A, SL) and fares. |
| 2 | `station` | Master directory of all railway stations and junction codes. |
| 3 | `train` | Master directory of all trains operating in the network. |
| 4 | `route_station` | Maps trains to their sequential route stops, distances, and timetables. |
| 5 | `train_coach` | Defines the physical coach composition attached to each train. |
| 6 | `train_schedule` | Defines the weekly operating days (MON-SUN) for each train. |
| 7 | `train_run` | Tracks specific operational dates and statuses (Scheduled, Delayed, Cancelled) for trains. |

---

## **Table Specifications**

### 1. `travel_class`
* Stores accommodation types, base fare calculations, and reservation surcharges.
* **Primary Key:** `class_code` (VARCHAR)

### 2. `station`
* Stores unique station identifiers and descriptive station names.
* **Primary Key:** `station_code` (VARCHAR)

### 3. `train`
* Stores core train details and active status flags.
* **Primary Key:** `train_no` (INTEGER)

### 4. `route_station`
* Handles multi-stop route sequences, arrival/departure timings, and cumulative distance from origin.
* **Primary Key:** Composite (`train_no`, `stop_seq`)
* **Foreign Keys:** `train_no` $\rightarrow$ `train(train_no)`, `station_code` $\rightarrow$ `station(station_code)`

### 5. `train_coach`
* Maps individual train sets to their respective physical coaches and travel classes.
* **Primary Key:** Composite (`train_no`, `coach_no`)
* **Foreign Keys:** `train_no` $\rightarrow$ `train(train_no)`, `class_code` $\rightarrow$ `travel_class(class_code)`

### 6. `train_schedule`
* Maps weekly recurring days of operation for each train.
* **Primary Key:** Composite (`train_no`, `run_day`)
* **Foreign Keys:** `train_no` $\rightarrow$ `train(train_no)`

### 7. `train_run`
* Handles instance-based scheduling for the next 14 days, tracking operational exceptions.
* **Primary Key:** `run_id` (Auto-generated Identity)
* **Unique Constraint:** (`train_no`, `run_date`)
* **Foreign Keys:** `train_no` $\rightarrow$ `train(train_no)`