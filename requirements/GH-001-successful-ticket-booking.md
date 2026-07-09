# GH-001: Successful ticket booking

**As a** fan
**I want to** browse an upcoming match, pick my seats, and confirm a booking
**So that** I have a ticket for the game without leaving the site

## Acceptance criteria

- A visitor can browse the home page and filter events by sport and league.
- Opening an upcoming event shows a seat map broken out by section, with
  live availability (available / selected / sold).
- Selecting seats updates a running total before checkout.
- Checkout requires being logged in; an anonymous user is redirected to log
  in first and returned to checkout afterward.
- After confirming, the booking appears on the user's "My Bookings" page
  with the correct seats and total price.
- Booking 4 or more seats in one transaction applies a 10% group discount,
  shown both before and after confirming.
