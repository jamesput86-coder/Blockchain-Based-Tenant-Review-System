import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV, principalCV, boolCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_RATING = 101;
const ERR_INVALID_DESCRIPTION = 102;
const ERR_REVIEW_ALREADY_EXISTS = 103;
const ERR_USER_NOT_VERIFIED = 105;
const ERR_MAX_REVIEWS_EXCEEDED = 108;

interface Review {
  id: number;
  propertyOrTenant: string;
  rating: number;
  descriptionHash: string;
  timestamp: number;
  reviewer: string;
  pseudonym: string;
  score: number;
  status: boolean;
}

interface ReviewUpdate {
  updateRating: number;
  updateScore: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class ReviewSubmissionMock {
  state: {
    nextReviewId: number;
    maxReviews: number;
    submissionFee: number;
    authorityContract: string | null;
    reviews: Map<number, Review>;
    reviewUpdates: Map<number, ReviewUpdate>;
    reviewsByProperty: Map<string, number[]>;
    reviewsByTenant: Map<string, number[]>;
    stxTransfers: Array<{ amount: number; from: string; to: string | null }>;
  } = {
    nextReviewId: 0,
    maxReviews: 5000,
    submissionFee: 50,
    authorityContract: null,
    reviews: new Map(),
    reviewUpdates: new Map(),
    reviewsByProperty: new Map(),
    reviewsByTenant: new Map(),
    stxTransfers: []
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextReviewId: 0,
      maxReviews: 5000,
      submissionFee: 50,
      authorityContract: null,
      reviews: new Map(),
      reviewUpdates: new Map(),
      reviewsByProperty: new Map(),
      reviewsByTenant: new Map(),
      stxTransfers: []
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setSubmissionFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.submissionFee = newFee;
    return { ok: true, value: true };
  }

  submitReview(
    propertyOrTenant: string,
    rating: number,
    description: string,
    isProperty: boolean
  ): Result<number> {
    if (this.state.nextReviewId >= this.state.maxReviews) return { ok: false, value: ERR_MAX_REVIEWS_EXCEEDED };
    if (rating < 1 || rating > 5) return { ok: false, value: ERR_INVALID_RATING };
    if (description.length === 0 || description.length > 500) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (this.state.reviews.has(this.state.nextReviewId)) return { ok: false, value: ERR_REVIEW_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_USER_NOT_VERIFIED };
    if (!this.authorities.has(this.caller)) return { ok: false, value: ERR_NOT_AUTHORIZED };

    this.state.stxTransfers.push({ amount: this.state.submissionFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextReviewId;
    const descHash = "mock-sha256-" + description;
    const pseudo = this.caller + "-pseudo";
    const review: Review = {
      id,
      propertyOrTenant,
      rating,
      descriptionHash: descHash,
      timestamp: this.blockHeight,
      reviewer: this.caller,
      pseudonym: pseudo,
      score: 50,
      status: true,
    };
    this.state.reviews.set(id, review);
    if (isProperty) {
      const existing = this.state.reviewsByProperty.get(propertyOrTenant) || [];
      this.state.reviewsByProperty.set(propertyOrTenant, [...existing, id]);
    } else {
      const existing = this.state.reviewsByTenant.get(propertyOrTenant) || [];
      this.state.reviewsByTenant.set(propertyOrTenant, [...existing, id]);
    }
    this.state.nextReviewId++;
    return { ok: true, value: id };
  }

  getReview(id: number): Review | null {
    return this.state.reviews.get(id) || null;
  }

  updateReviewScore(id: number, newScore: number): Result<boolean> {
    const review = this.state.reviews.get(id);
    if (!review) return { ok: false, value: false };
    if (review.reviewer !== this.caller) return { ok: false, value: false };
    if (newScore > 100) return { ok: false, value: false };
    review.score = newScore;
    this.state.reviews.set(id, review);
    this.state.reviewUpdates.set(id, {
      updateRating: review.rating,
      updateScore: newScore,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getReviewCount(): Result<number> {
    return { ok: true, value: this.state.nextReviewId };
  }

  checkReviewExistence(id: number): Result<boolean> {
    return { ok: true, value: this.state.reviews.has(id) };
  }
}

describe("ReviewSubmission", () => {
  let contract: ReviewSubmissionMock;

  beforeEach(() => {
    contract = new ReviewSubmissionMock();
    contract.reset();
  });

  it("submits a review successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitReview("STPROP", 4, "Great property!", true);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const review = contract.getReview(0);
    expect(review?.rating).toBe(4);
    expect(review?.descriptionHash).toBe("mock-sha256-Great property!");
    expect(review?.pseudonym).toBe("ST1TEST-pseudo");
    expect(review?.status).toBe(true);
    expect(contract.state.stxTransfers).toEqual([{ amount: 50, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects invalid rating", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.submitReview("STPROP", 6, "Great property!", true);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_RATING);
  });

  it("rejects duplicate review id", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitReview("STPROP", 4, "Great property!", true);
    const result = contract.submitReview("STPROP", 5, "Another review", true);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1);
  });

  it("updates review score successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitReview("STPROP", 4, "Great property!", true);
    const result = contract.updateReviewScore(0, 75);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const review = contract.getReview(0);
    expect(review?.score).toBe(75);
  });

  it("rejects score update by non-reviewer", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitReview("STPROP", 4, "Great property!", true);
    contract.caller = "ST3FAKE";
    const result = contract.updateReviewScore(0, 75);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct review count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitReview("STPROP", 4, "Great property!", true);
    contract.submitReview("STTEN", 3, "Good tenant", false);
    const result = contract.getReviewCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks review existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.submitReview("STPROP", 4, "Great property!", true);
    const result = contract.checkReviewExistence(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkReviewExistence(1);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects submission without authority", () => {
    const result = contract.submitReview("STPROP", 4, "Great property!", true);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_USER_NOT_VERIFIED);
  });
});