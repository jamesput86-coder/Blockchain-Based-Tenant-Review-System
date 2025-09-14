(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-RATING u101)
(define-constant ERR-INVALID-DESCRIPTION u102)
(define-constant ERR-REVIEW-ALREADY-EXISTS u103)
(define-constant ERR-INVALID-TIMESTAMP u104)
(define-constant ERR-USER-NOT-VERIFIED u105)
(define-constant ERR-INVALID-PSEUDONYM u106)
(define-constant ERR-INVALID-SCORE u107)
(define-constant ERR-MAX-REVIEWS-EXCEEDED u108)
(define-constant ERR-INVALID-PROPERTY-ADDRESS u109)
(define-constant ERR-INVALID-TENANT-ADDRESS u110)
(define-constant ERR-ANONYMITY-FAILED u111)
(define-constant ERR-RATING-SYSTEM-FAILED u112)
(define-constant ERR-QUERY-NOT-FOUND u113)

(define-data-var next-review-id uint u0)
(define-data-var max-reviews uint u5000)
(define-data-var submission-fee uint u50)
(define-data-var authority-contract (optional principal) none)

(define-map reviews
  uint
  {
    id: uint,
    property-or-tenant: principal,
    rating: uint,
    description-hash: (string-ascii 64),
    timestamp: uint,
    reviewer: principal,
    pseudonym: principal,
    score: uint,
    status: bool
  }
)

(define-map reviews-by-property
  principal
  (list 100 uint)
)

(define-map reviews-by-tenant
  principal
  (list 100 uint)
)

(define-map review-updates
  uint
  {
    update-rating: uint,
    update-score: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-review (id uint))
  (map-get? reviews id)
)

(define-read-only (get-review-updates (id uint))
  (map-get? review-updates id)
)

(define-read-only (get-reviews-by-property (prop principal))
  (map-get? reviews-by-property prop)
)

(define-read-only (get-reviews-by-tenant (tenant principal))
  (map-get? reviews-by-tenant tenant)
)

(define-read-only (is-review-registered (id uint))
  (is-some (map-get? reviews id))
)

(define-private (validate-rating (rating uint))
  (if (and (> rating u0) (<= rating u5))
      (ok true)
      (err ERR-INVALID-RATING))
)

(define-private (validate-description (desc (string-ascii 500)))
  (if (and (> (len desc) u0) (<= (len desc) u500))
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-private (validate-pseudonym (pseudo principal))
  (if (> (len (to-ascii pseudo)) u0)
      (ok true)
      (err ERR-INVALID-PSEUDONYM))
)

(define-private (validate-score (score uint))
  (if (<= score u100)
      (ok true)
      (err ERR-INVALID-SCORE))
)

(define-private (validate-property-address (addr principal))
  (if (is-standard principal-type addr)
      (ok true)
      (err ERR-INVALID-PROPERTY-ADDRESS))
)

(define-private (validate-tenant-address (addr principal))
  (if (is-standard principal-type addr)
      (ok true)
      (err ERR-INVALID-TENANT-ADDRESS))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-NOT-AUTHORIZED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-reviews (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-SCORE))
    (asserts! (is-some (var-get authority-contract)) (err ERR-USER-NOT-VERIFIED))
    (var-set max-reviews new-max)
    (ok true)
  )
)

(define-public (set-submission-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-DESCRIPTION))
    (asserts! (is-some (var-get authority-contract)) (err ERR-USER-NOT-VERIFIED))
    (var-set submission-fee new-fee)
    (ok true)
  )
)

(define-public (submit-review
  (property-or-tenant principal)
  (rating uint)
  (description (string-ascii 500))
  (is-property bool)
)
  (let (
        (next-id (var-get next-review-id))
        (current-max (var-get max-reviews))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-REVIEWS-EXCEEDED))
    (try! (validate-rating rating))
    (try! (validate-description description))
    (if is-property
        (try! (validate-property-address property-or-tenant))
        (try! (validate-tenant-address property-or-tenant))
    )
    (asserts! (is-none (map-get? reviews next-id)) (err ERR-REVIEW-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-USER-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get submission-fee) tx-sender authority-recipient))
    )
    (let (
          (desc-hash (sha256 (concat (to-ascii property-or-tenant) description)))
          (pseudo (generate-pseudonym tx-sender))
          (initial-score u50)
        )
      (map-set reviews next-id
        {
          id: next-id,
          property-or-tenant: property-or-tenant,
          rating: rating,
          description-hash: desc-hash,
          timestamp: block-height,
          reviewer: tx-sender,
          pseudonym: pseudo,
          score: initial-score,
          status: true
        }
      )
      (if is-property
          (let ((existing (default-to (list) (map-get? reviews-by-property property-or-tenant))))
            (map-set reviews-by-property property-or-tenant (append existing next-id))
          )
          (let ((existing (default-to (list) (map-get? reviews-by-tenant property-or-tenant))))
            (map-set reviews-by-tenant property-or-tenant (append existing next-id))
          )
      )
      (var-set next-review-id (+ next-id u1))
      (print { event: "review-submitted", id: next-id })
      (ok next-id)
    )
  )
)

(define-public (update-review-score (review-id uint) (new-score uint))
  (let ((review (map-get? reviews review-id)))
    (match review
      r
        (begin
          (asserts! (is-eq (get reviewer r) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-score new-score))
          (map-set reviews review-id
            {
              id: (get id r),
              property-or-tenant: (get property-or-tenant r),
              rating: (get rating r),
              description-hash: (get description-hash r),
              timestamp: (get timestamp r),
              reviewer: (get reviewer r),
              pseudonym: (get pseudonym r),
              score: new-score,
              status: (get status r)
            }
          )
          (map-set review-updates review-id
            {
              update-rating: (get rating r),
              update-score: new-score,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "review-score-updated", id: review-id })
          (ok true)
        )
      (err ERR-QUERY-NOT-FOUND)
    )
  )
)

(define-public (get-review-count)
  (ok (var-get next-review-id))
)

(define-public (check-review-existence (id uint))
  (ok (is-review-registered id))
)