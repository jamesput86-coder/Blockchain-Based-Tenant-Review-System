# 🏠 Blockchain-Based Tenant Review System

This project leverages the Stacks blockchain and Clarity smart contracts to create a decentralized, anonymized tenant review system. It addresses the real-world problem of biased or manipulated tenant reviews in the rental market by ensuring transparency, fairness, and immutability. Landlords and tenants can submit and access reviews anonymously, with data stored securely on the blockchain to prevent tampering and ensure trust.

## ✨ Features

- 🔒 **Anonymous Reviews**: Tenants and landlords submit reviews without revealing personal identities, using blockchain addresses for pseudonymity.
- 📝 **Immutable Records**: Reviews are stored on the blockchain, ensuring they cannot be altered or deleted.
- 🛡️ **Fairness Mechanism**: Reviews are moderated through a scoring system to prevent malicious or fake entries.
- 🔍 **Searchable Reviews**: Users can query reviews by property or tenant address, maintaining privacy.
- ✅ **Verification Process**: Ensures only verified landlords and tenants can submit reviews.
- 🛠 **Dispute Resolution**: A mechanism for flagging and resolving disputed reviews.

## 🛠 How It Works

**For Tenants and Landlords**:
- Register as a verified user (tenant or landlord) using the `user-registry` contract.
- Submit anonymized reviews for a property or tenant via the `review-submission` contract, including a rating and description.
- Reviews are hashed and stored on-chain for immutability.
- Use the `review-verification` contract to confirm the authenticity of a review.

**For Reviewers**:
- Query reviews for a specific property or tenant using the `review-query` contract.
- Verify the legitimacy of a review through the blockchain’s timestamp and submitter address.
- Flag suspicious reviews via the `dispute-resolution` contract for community review.

**For Administrators**:
- Manage user verification and disputes through the `admin-controls` contract.
- Ensure system integrity by updating contract parameters (e.g., review submission criteria).

## 📂 Smart Contracts

The system consists of 8 Clarity smart contracts, each handling a specific function:

1. **user-registry.clar**: Manages tenant and landlord registration and verification.
2. **review-submission.clar**: Handles submission of anonymized reviews with ratings and descriptions.
3. **review-verification.clar**: Verifies the authenticity of reviews based on submitter and timestamp.
4. **review-query.clar**: Allows users to query reviews by property or tenant address.
5. **dispute-resolution.clar**: Manages flagging and resolution of disputed reviews.
6. **rating-system.clar**: Implements a scoring mechanism to filter malicious reviews.
7. **anonymity-manager.clar**: Ensures reviews are anonymized by mapping addresses to pseudonymous IDs.
8. **admin-controls.clar**: Provides administrative functions for managing the system.

## 📜 License

This project is licensed under the MIT License.
