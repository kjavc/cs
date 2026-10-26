# Rules for Computing Student Contact Hours

This document outlines the rules for computing student contact hours for college courses. These rules are designed to be used by an agent to build an application that can generate scheduling examples.

## Core Concepts

*   **Class Hour (Contact Hour):** The fundamental unit of attendance. It represents at least **50 minutes** of scheduled instruction.
*   **Clock Hour:** A **60-minute** time frame.
*   **Break Time:** Each clock hour includes a **10-minute** break (or "passing time").

## General Calculation Formula

The total contact hours for a class are calculated based on the total duration of the class meeting in minutes.

1.  **Calculate the number of breaks:**
    *   No breaks for classes 95 minutes or shorter.
    *   For classes longer than 95 minutes, the number of 10-minute breaks is calculated as:
        `NumberOfBreaks = floor((TotalClassMinutes - 50) / 60)`

2.  **Calculate the total instructional minutes:**
    *   `InstructionalMinutes = TotalClassMinutes - (NumberOfBreaks * 10)`

3.  **Calculate the total contact hours:**
    *   `ContactHours = InstructionalMinutes / 50`

## Scheduling Rules and Constraints

*   Class schedules must use five-minute increments for start and end times (e.g., 8:00 AM to 9:25 AM).
*   A "partial class hour" (the remainder after dividing by 50) cannot exceed 45 minutes. This means any instructional time over 45 minutes in the final partial hour requires another full 10-minute break to be scheduled *before* it, effectively making it part of the next clock hour.
*   Breaks may not be accumulated and taken at the end of a class. They must be taken as scheduled within their respective clock hours.

## Examples

Here are some examples of how to calculate contact hours for different class lengths, extrapolating from the provided chart.

### 1 Contact Hour
*   **Total Time:** 50 minutes
*   **Breaks:** 0
*   **Instructional Minutes:** 50
*   **Calculation:** `50 / 50 = 1.0`
*   **Scheduling Example:** 8:00 AM - 8:50 AM

### 1.5 Contact Hours
*   **Total Time:** 75 minutes
*   **Breaks:** 0
*   **Instructional Minutes:** 75
*   **Calculation:** `75 / 50 = 1.5`
*   **Scheduling Example:** 8:00 AM - 9:15 AM

### 2 Contact Hours
*   **Total Time:** 110 minutes (1 hour, 50 minutes)
*   **Breaks:** `floor((110 - 50) / 60) = 1` (one 10-minute break)
*   **Instructional Minutes:** `110 - (1 * 10) = 100`
*   **Calculation:** `100 / 50 = 2.0`
*   **Scheduling Example:** 8:00 AM - 9:50 AM (with a 10-minute break from 8:50 to 9:00)

### 3.7 Contact Hours
*   **Total Time:** 205 minutes (3 hours, 25 minutes)
*   **Breaks:** `floor((205 - 50) / 60) = 2` (two 10-minute breaks)
*   **Instructional Minutes:** `205 - (2 * 10) = 185`
*   **Calculation:** `185 / 50 = 3.7`
*   **Scheduling Example:** 8:00 AM - 11:25 AM (with breaks at 8:50-9:00 and 9:50-10:00)

### 7 Contact Hours (Extended Example)
*   **Contact Hours:** 7.0
*   **Instructional Minutes:** `7.0 * 50 = 350`
*   **To find the number of breaks, we can solve for TotalClassMinutes:**
    *   `350 = TotalClassMinutes - (floor((TotalClassMinutes - 50) / 60) * 10)`
    *   By referencing the pattern in the chart, 6 full hours is 350 minutes. We can deduce that 7 full hours would be `6 * 60 + 50 = 410` minutes long.
    *   Let's test this:
        *   **Total Time:** 410 minutes (6 hours, 50 minutes)
        *   **Breaks:** `floor((410 - 50) / 60) = floor(360 / 60) = 6` (six 10-minute breaks)
        *   **Instructional Minutes:** `410 - (6 * 10) = 350`
        *   **Calculation:** `350 / 50 = 7.0`
*   **Scheduling Example:** 8:00 AM - 2:50 PM (with six 10-minute breaks)
