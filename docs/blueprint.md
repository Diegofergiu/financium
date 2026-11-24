# **App Name**: Mi Bolsillo

## Core Features:

- Secure User Authentication & Account Management: Robust user registration, login, and session management using Firebase Authentication (Email/Password and Google), supporting multi-tenancy with data isolated by user.
- Shared Wallet Management: Users can create and manage financial 'Wallets' (Workspaces) for personal or business use, inviting other users via email to share access with editor or reader permissions. Data within each wallet is isolated and secured.
- Dynamic Transaction Tracking: Record income and expenses with customizable categories (including name and hex color), amount, date, description, and payment method. An AI tool helps pre-fill forms by suggesting categories based on transaction descriptions.
- Comprehensive Checks Module: Manage both 'Checks to Collect' and 'Checks Issued' with detailed fields including check number, bank, issuer/recipient, due date, amount, and an `isCleared` status for accurate balance reconciliation. Allows attaching scanned check images.
- Interactive Financial Dashboard: A centralized dashboard displaying an overall balance summary (income - expenses), a cash flow chart for the current month, a list of recent transactions, and critical alerts for checks due in the next 15 days.
- Visual Reporting & Balances: Dynamic visualization of financial balances and transaction summaries over weekly, monthly, and annual periods through interactive bar and pie charts for each wallet.
- Attachment Management: Securely upload and link images, such as photos of checks or expense receipts, directly to individual transactions or check records using Firebase Storage. An AI tool can be used to automatically extract and populate key details from these attachments into the transaction or check form.

## Style Guidelines:

- Primary interactive elements will use a deep, trustworthy blue (#163A82), reflecting a professional and stable financial environment. This hue instills confidence and clarity.
- The main background will feature an extremely light, desaturated blue-grey (#F7F9FB). This almost-white hue creates a clean and spacious canvas, minimizing visual clutter and enhancing readability in a light scheme.
- An accent color of vibrant yet sophisticated purple (#6E3FCD) will highlight calls to action, important notifications, and provide a clear visual hierarchy. This distinct color ensures crucial information stands out effectively.
- The application will support both light and dark modes, with a dynamically adjusting color scheme that maintains readability and visual appeal across themes, ensuring user preference is always accommodated.
- The primary font for all headlines and body text will be 'Inter' (sans-serif), chosen for its exceptional legibility, modern aesthetic, and suitability for data-rich interfaces characteristic of financial SaaS platforms.
- Leveraging Lucide React, the application will use a consistent set of clean, outline-style icons. These minimalist icons enhance clarity and contribute to a premium, uncluttered visual design.
- A clean, modern, and intuitive layout will feature a structured dashboard with organized data, clear navigation (likely a sidebar), and responsive components crafted with Shadcn/UI to adapt seamlessly across different devices.
- Subtle and purposeful animations will be incorporated for state changes, data loading, and interactive elements. These micro-interactions will provide responsive feedback and enhance the overall user experience without distracting from core financial data.