-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Jan 15, 2025 at 07:49 PM
-- Server version: 8.0.30
-- PHP Version: 8.1.10

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `moviesho_fashion_glory_pos`
--

-- --------------------------------------------------------

--
-- Table structure for table `sequelizemeta`
--

CREATE TABLE `sequelizemeta` (
  `name` varchar(255) COLLATE utf8mb3_unicode_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int NOT NULL,
  `fullName` varchar(255) NOT NULL COMMENT 'Name of the user or shop owner',
  `email` varchar(100) NOT NULL,
  `phoneNumber` varchar(15) NOT NULL COMMENT 'Phone number of the user',
  `location` varchar(255) NOT NULL COMMENT 'User''s location',
  `businessName` varchar(255) NOT NULL COMMENT 'Name of the user''s business',
  `businessType` varchar(255) NOT NULL COMMENT 'Type of business the user runs',
  `password` varchar(255) NOT NULL COMMENT 'Hashed password of the user',
  `accountStatus` enum('active','inactive') NOT NULL DEFAULT 'inactive' COMMENT 'Status of the user account',
  `isVerified` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Indicates if the user is email verified',
  `verificationToken` varchar(255) DEFAULT NULL COMMENT 'Token for email verification',
  `isLoggedIn` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Tracks if the user is currently logged in',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `fullName`, `email`, `phoneNumber`, `location`, `businessName`, `businessType`, `password`, `accountStatus`, `isVerified`, `verificationToken`, `isLoggedIn`, `createdAt`, `updatedAt`) VALUES
(1, 'John Doe', 'john.doe@example.com', '1234567890', 'New York, USA', 'John\'s Cafe', 'Food & Beverages', '$2b$10$JXqJTO6zzZVWoQQ2VOAsJeePWTIBI4vWeYvhY1c.PesfiRhkyFfqy', 'active', 0, 'exampleVerificationToken123', 0, '2025-01-15 18:30:01', '2025-01-15 18:30:01'),
(8, 'John Doe', 'demo8@example.com', '12345567890', 'New York, USA', 'John\'s Cafe', 'Food & Beverages', '$2b$10$yK9kxSRJlI2llXl3VFziEeVCOnxzODmbaBWmJuQ/wctVwsJx9EScK', 'active', 1, 'exampleVerificationToken123', 0, '2025-01-15 19:01:45', '2025-01-15 19:01:45'),
(9, 'Jane Smith', 'jane.smith@example.com', '0987654321', 'Los Angeles, USA', 'Smith Supplies', 'Retail', '$2b$10$VjqslKaTwPyWL3fvnJ5UJuWl2cn8TnJfxKFfN/3TGZZ5yr2a1J6WC', 'inactive', 0, NULL, 0, '2025-01-15 19:01:45', '2025-01-15 19:01:45');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `sequelizemeta`
--
ALTER TABLE `sequelizemeta`
  ADD PRIMARY KEY (`name`),
  ADD UNIQUE KEY `name` (`name`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`),
  ADD UNIQUE KEY `phoneNumber` (`phoneNumber`),
  ADD UNIQUE KEY `email_2` (`email`),
  ADD UNIQUE KEY `phoneNumber_2` (`phoneNumber`),
  ADD UNIQUE KEY `email_3` (`email`),
  ADD UNIQUE KEY `phoneNumber_3` (`phoneNumber`),
  ADD UNIQUE KEY `email_4` (`email`),
  ADD UNIQUE KEY `phoneNumber_4` (`phoneNumber`),
  ADD UNIQUE KEY `email_5` (`email`),
  ADD UNIQUE KEY `phoneNumber_5` (`phoneNumber`),
  ADD UNIQUE KEY `email_6` (`email`),
  ADD UNIQUE KEY `phoneNumber_6` (`phoneNumber`),
  ADD UNIQUE KEY `email_7` (`email`),
  ADD UNIQUE KEY `phoneNumber_7` (`phoneNumber`),
  ADD UNIQUE KEY `email_8` (`email`),
  ADD UNIQUE KEY `phoneNumber_8` (`phoneNumber`),
  ADD UNIQUE KEY `email_9` (`email`),
  ADD UNIQUE KEY `phoneNumber_9` (`phoneNumber`),
  ADD UNIQUE KEY `email_10` (`email`),
  ADD UNIQUE KEY `phoneNumber_10` (`phoneNumber`),
  ADD UNIQUE KEY `email_11` (`email`),
  ADD UNIQUE KEY `phoneNumber_11` (`phoneNumber`),
  ADD UNIQUE KEY `email_12` (`email`),
  ADD UNIQUE KEY `phoneNumber_12` (`phoneNumber`),
  ADD UNIQUE KEY `email_13` (`email`),
  ADD UNIQUE KEY `phoneNumber_13` (`phoneNumber`),
  ADD UNIQUE KEY `email_14` (`email`),
  ADD UNIQUE KEY `phoneNumber_14` (`phoneNumber`),
  ADD UNIQUE KEY `email_15` (`email`),
  ADD UNIQUE KEY `phoneNumber_15` (`phoneNumber`),
  ADD UNIQUE KEY `email_16` (`email`),
  ADD UNIQUE KEY `phoneNumber_16` (`phoneNumber`),
  ADD UNIQUE KEY `email_17` (`email`),
  ADD UNIQUE KEY `phoneNumber_17` (`phoneNumber`),
  ADD UNIQUE KEY `email_18` (`email`),
  ADD UNIQUE KEY `phoneNumber_18` (`phoneNumber`),
  ADD UNIQUE KEY `email_19` (`email`),
  ADD UNIQUE KEY `phoneNumber_19` (`phoneNumber`),
  ADD UNIQUE KEY `email_20` (`email`),
  ADD UNIQUE KEY `phoneNumber_20` (`phoneNumber`),
  ADD UNIQUE KEY `email_21` (`email`),
  ADD UNIQUE KEY `phoneNumber_21` (`phoneNumber`),
  ADD UNIQUE KEY `email_22` (`email`),
  ADD UNIQUE KEY `phoneNumber_22` (`phoneNumber`),
  ADD UNIQUE KEY `email_23` (`email`),
  ADD UNIQUE KEY `phoneNumber_23` (`phoneNumber`),
  ADD UNIQUE KEY `email_24` (`email`),
  ADD UNIQUE KEY `phoneNumber_24` (`phoneNumber`),
  ADD UNIQUE KEY `email_25` (`email`),
  ADD UNIQUE KEY `phoneNumber_25` (`phoneNumber`),
  ADD UNIQUE KEY `email_26` (`email`),
  ADD UNIQUE KEY `phoneNumber_26` (`phoneNumber`),
  ADD UNIQUE KEY `email_27` (`email`),
  ADD UNIQUE KEY `phoneNumber_27` (`phoneNumber`),
  ADD UNIQUE KEY `email_28` (`email`),
  ADD UNIQUE KEY `phoneNumber_28` (`phoneNumber`),
  ADD UNIQUE KEY `email_29` (`email`),
  ADD UNIQUE KEY `phoneNumber_29` (`phoneNumber`),
  ADD UNIQUE KEY `email_30` (`email`),
  ADD UNIQUE KEY `phoneNumber_30` (`phoneNumber`),
  ADD UNIQUE KEY `email_31` (`email`),
  ADD UNIQUE KEY `phoneNumber_31` (`phoneNumber`),
  ADD UNIQUE KEY `email_32` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=13;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
