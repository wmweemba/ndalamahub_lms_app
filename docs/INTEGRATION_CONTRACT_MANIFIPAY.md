# Integration contract — manifipay.com public intake

**Phase:** 22 (public application intake API). **Owner of the website-side change:** William, in the `manifipay_website` repo — not this repo, and not this phase's code.

This is the contract the manifipay.com website form must satisfy to submit loan applications into NdalamaHub as `CustomerApplication` (prospect) records. Submitting an application creates no `User` and no `Loan` — a lender staff member reviews and converts it via `PUT /api/customer-applications/:id/approve` (or rejects it).

## Endpoint

```
POST /api/public/:slug/applications
Content-Type: application/json
```

- **Dev:** `https://ndalamahub-lms-app.onrender.com/api/public/manifipay/applications`
- **Prod (post-Coolify cutover, Phase 26):** update once the production URL is known.

The current manifipay site posts `FormData` to a Sentinel URL — the website-side change is to switch to a JSON body against the URL above. `:slug` is `manifipay` for Manifi; it is a per-lender identifier configured server-side (`Company.publicIntake.slug`), never a client-supplied id.

## CORS

The endpoint reflects only the lender's registered `allowedOrigin` (`https://manifipay.com` for Manifi). Requests from any other browser origin will not receive the CORS headers needed for the browser to read the response (server-to-server / no-`Origin` requests, e.g. curl, are accepted regardless — origin is a hurdle here, not the security boundary).

## Request body

```json
{
  "applicant": {
    "fullName": "string, required",
    "nrc": "string, required — digits and slashes only",
    "phone": "string, required",
    "email": "string, optional",
    "address": "string, required",
    "employmentStatus": "string, required",
    "employerName": "string, optional",
    "monthlyIncome": "number, optional"
  },
  "loanRequest": {
    "amount": "number, required, > 0 and <= 1,000,000",
    "purpose": "string, required",
    "termDays": "number, required, 1–365 (Manifi's site always sends 30 today)"
  },
  "collateral": {
    "type": "vehicle | business_equipment | title_deed | other — optional",
    "otherDescription": "string, required only when type is \"other\"",
    "description": "string, required when collateral is provided",
    "estimatedValue": "number, optional"
  },
  "website": ""
}
```

`collateral` may be omitted entirely if the applicant declares none.

### Field mapping — `index.html` id → API field

| Website field (`index.html` id) | API field |
|---|---|
| `form-full-name` | `applicant.fullName` |
| `form-nrc` | `applicant.nrc` |
| `form-phone` | `applicant.phone` |
| `form-email` | `applicant.email` (optional) |
| `form-address` | `applicant.address` |
| `form-employment-status` | `applicant.employmentStatus` |
| `form-employer-name` | `applicant.employerName` (conditional) |
| `form-monthly-income` | `applicant.monthlyIncome` |
| `form-loan-amount` | `loanRequest.amount` |
| `form-loan-purpose` (+ `-other`) | `loanRequest.purpose` |
| `form-repayment-term` | `loanRequest.termDays` (always 30 today) |
| `form-collateral-type` | `collateral.type` (map website labels → the enum above; "other" carries `otherDescription`) |
| `form-collateral-description` | `collateral.description` |
| *(hidden honeypot input, must stay empty)* | `website` |

The `website` field must exist in the form as a hidden input a real visitor never fills in, and must always be sent empty. If a bot fills it, the API returns `200` with a fake reference and silently creates no record — the website's confirmation UI should behave identically either way.

## Response contract

- **Success:** `201 { "success": true, "reference": "APP20260001" }` — show `reference` in the existing confirmation UI.
- **Honeypot triggered:** `200 { "success": true, "reference": "<fake>" }` — indistinguishable from success on purpose.
- **Validation / abuse errors:** `4xx { "success": false, "message": "...", "errors"?: [...] }`
  - `404` — unknown or disabled slug (treat as a generic "service unavailable" on the website; don't leak which).
  - `429` — rate limited (10/hour/IP, plus a burst limiter). Show a "please try again shortly" message.
  - `503` — the lender's NdalamaHub subscription is locked; applications are temporarily off. Do not surface subscription detail to the website visitor.
  - `400` — validation failure; `errors` is an array of human-readable messages.

## What the website change is (not built here)

1. Swap `SUBMIT_SENTINEL_URL` for the endpoint above.
2. Change the submit from `FormData` to a JSON `fetch`/`XHR` body matching the shape above, `Content-Type: application/json`.
3. Add the hidden honeypot `website` input if the current form doesn't already have one.
4. Show the returned `reference` in the existing confirmation UI.

That work happens in the `manifipay_website` repo, on William's side, once this endpoint is live in the target environment.
