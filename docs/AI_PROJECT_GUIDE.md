# AI Project Guide: Point of Sale (POS) System

## Project Overview
- **Goal**: Develop a professional Point of Sale system.
- **Stack**: React (Frontend), C# ASP.NET (Backend), MySQL (Database).
- **Key Integration**: Mercado Pago Dynamic QR Codes for virtual payments.
- **Team Size**: 5 Developers.

## Development Workflow (Mandatory Order)
1. **Analysis Phase (Current)**: Requirements, User Journeys, UX Guidelines, and System Analysis.
2. **Design Phase**: ERD (Database), Sequence Diagrams, API Contracts (Swagger), and UI Wireframes.
3. **Implementation Phase**: Iterative development based on the analysis.
4. **Verification Phase**: Testing and Validation.

## Critical Technical Decisions
- **QR Model**: Dynamic QR codes via Mercado Pago Orders API.
- **Payment Flow**: Async flow using Webhooks (MP $\rightarrow$ Backend) and SignalR (Backend $\rightarrow$ Frontend).
- **State Management**: Zustand or Redux Toolkit for the React shopping cart.
- **Database**: ACID Transactions in MySQL to ensure stock consistency.
- **Security**: Access Tokens managed exclusively on the backend.

## Instructions for Future AI Models
- Always refer to `SYSTEM_ANALYSIS.md` before proposing changes.
- Maintain the "Analysis $\rightarrow$ Design $\rightarrow$ Dev" flow.
- Prioritize "Minimum Clicks" UX for the POS interface.
- Ensure every new feature is first documented in the analysis/design phase.
