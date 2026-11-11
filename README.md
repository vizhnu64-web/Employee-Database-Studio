# PeopleDesk Studio — Standalone Windows Desktop Application

**PeopleDesk Studio** is a complete, native-style Windows desktop application designed for HR professionals to maintain complete employee records and documents, import payroll spreadsheets, validate deterministic salary mathematics, preview high-fidelity A4 portrait payslips, generate vector PDFs, and export compressed ZIP bundles.

The application operates **100% locally and offline**. All Google Sheets, Google Cloud, external APIs, billing, online authentication, and network dependencies have been completely removed.

---

## 🌟 Key Features

1. **Comprehensive Employee Database & Document Management**:
   - Centralized HR directory for employee profiles, personal details, contact info, and employment milestones.
   - Secure local document storage (`%APPDATA%\PeopleDesk Studio\employee_documents`) with automatic legacy migration.
   - Categorized document attachments (Identity, Address, Education, Experience, Bank, Contracts).
   - Fast instant search across IDs, names, designations, and document titles.

2. **Local Excel & CSV Import**:
   - Supports `.xlsx`, `.xls`, and `.csv` files.
   - Preserves employee IDs as exact text, including leading zeros (e.g. `00101`, `EMP-0042`).
   - Dynamic worksheet tab selector for multi-sheet workbooks.
   - Dynamic column header detection with automated fuzzy matching and manual column overrides.

3. **Deterministic Mathematical Cross-Validation**:
   - Strictly enforces mathematical formulas without any AI guesses:
     - $\text{Gross Earnings} = \text{Basic} + \text{HRA} + \text{Special Allowance} + \text{Other Allowances}$
     - $\text{Total Deductions} = \text{PF} + \text{ESI} + \text{Professional Tax} + \text{TDS / Tax} + \text{Other Deductions}$
     - $\text{Net Salary Payable} = \text{Gross Earnings} - \text{Total Deductions}$
   - Flags discrepancies between spreadsheet-provided totals and calculated component sums.
   - Provides a one-click **"Auto-Fix Math Discrepancies"** tool to reconcile differences.

4. **Professional A4 Portrait Payslips**:
   - Formatted to standard corporate A4 dimensions (210mm × 297mm).
   - Includes Company Name, official address, registration ID, contact details, and optional corporate logo.
   - Employee summary block: ID, Name, Department, Designation, Joining Date, Bank Account, Paid Days, and LOP Days.
   - Dual-column table: **Earnings** vs **Deductions**.
   - Net pay highlight card with **amount in words** (supports USD, INR, EUR, GBP, CAD, AUD, AED).
   - Authorized signatory title and uploaded digital signature graphic.

5. **Batch Generation & Duplicate Protection**:
   - Bulk generates vector PDF payslips with live progress tracking.
   - Bundles all generated payslips into a single compressed `.zip` archive.
   - Composite duplicate protection key: `[EmployeeID]_[Month]_[Year]`.
   - Prevents accidental overwrites by warning HR if a payslip was already generated for that period and requiring explicit confirmation.

6. **Local Persistent Database**:
   - Stores employee records, payroll runs, company branding, and generation history locally in SQLite / IndexedDB (`%APPDATA%\PeopleDeskStudio`).
   - Full Database JSON Backup export and restore tools.
   - Complete data isolation: no data leaves the computer.

---

## 💻 Desktop Technology Stack

- **Desktop Framework**: Electron
- **User Interface**: React 19, TypeScript, Tailwind CSS
- **Local Spreadsheet Parser**: SheetJS (`xlsx`)
- **PDF Generation**: jsPDF (vector graphics, no web service)
- **ZIP Bundler**: JSZip
- **Persistence**: Local SQLite / IndexedDB with JSON backup
- **Packaging**: Electron Builder (NSIS Windows Installer `.exe` & Portable `.exe`)

---

## 🛠️ Building the Windows Executable (`.exe`)

### Prerequisites on Windows
- Node.js 20+ installed
- Windows 10 or 11 (64-bit)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Test in Development Desktop Mode
```bash
npm run electron:dev
```

### Step 3: Build Windows Installer and Portable Executable
```bash
npm run build:win
```
This command compiles the React frontend with Vite and invokes Electron Builder to generate:
- **Windows Installer (`.exe`)**: `release/PeopleDesk Studio Setup 1.0.0.exe` (NSIS installer with desktop shortcut and uninstaller)
- **Portable Executable (`.exe`)**: `release/PeopleDeskStudio-Portable-1.0.0.exe` (runs directly without installation)

---

## 🔒 Security Architecture

- **Context Isolation**: Enabled (`contextIsolation: true`)
- **Node Integration in Renderer**: Disabled (`nodeIntegration: false`)
- **Preload Bridge**: Only explicit dialog and save methods are exposed via `electronAPI`.
- **Zero Secrets / Zero Remote Execution**: 100% deterministic local computation.
