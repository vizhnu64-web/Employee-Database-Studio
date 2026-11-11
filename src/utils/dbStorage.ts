import {
  CompanySettings,
  EmployeeRecord,
  GeneratedPayslipRecord,
  PayslipLayoutSettings,
  DEFAULT_LAYOUT_SETTINGS,
  EmailSettings,
  DEFAULT_EMAIL_SETTINGS,
  CustomFieldDefinition,
  SavedImportConfig,
  ImportHistoryRecord
} from '../types/payroll';
import { DirectoryEmployee, EmployeeDocument } from '../types/employeeDirectory';
import { SEED_DIRECTORY_EMPLOYEES, SEED_EMPLOYEE_DOCUMENTS } from './employeeDb';

const DB_NAME = 'PaySlipStudio_LocalDB';
const DB_VERSION = 3;

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: 'Apex Enterprise Solutions Inc.',
  addressLine1: '450 Innovation Parkway, Suite 800',
  addressLine2: 'Tech District',
  cityStateZip: 'San Francisco, CA 94107',
  phone: '+1 (555) 492-8000',
  email: 'payroll@apexenterprise.com',
  website: 'www.apexenterprise.com',
  taxRegistrationNumber: 'US-EIN-94-3829104',
  currencySymbol: '$',
  currencyName: 'USD',
  showCurrencySymbol: true,
  authorizedSignatoryName: 'Eleanor Vance',
  authorizedSignatoryTitle: 'Director of Human Resources',
  payslipNote: 'Confidential document. Direct questions regarding salary deductions to HR/Payroll department.',
  themeColor: '#CB1417'
};

class LocalDatabase {
  private db: IDBDatabase | null = null;
  private isReadyPromise: Promise<IDBDatabase | null>;

  constructor() {
    this.isReadyPromise = this.initDB();
  }

  private initDB(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        return resolve(null);
      }

      const timer = setTimeout(() => {
        resolve(this.db || null);
      }, 800);

      try {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains('employee_records')) {
            db.createObjectStore('employee_records', { keyPath: 'id' });
          }

          if (!db.objectStoreNames.contains('settings')) {
            db.createObjectStore('settings', { keyPath: 'id' });
          }

          if (!db.objectStoreNames.contains('generated_history')) {
            const histStore = db.createObjectStore('generated_history', { keyPath: 'id' });
            histStore.createIndex('by_period', ['month', 'year'], { unique: false });
            histStore.createIndex('by_employee', 'employeeId', { unique: false });
          }

          if (!db.objectStoreNames.contains('directory_employees')) {
            const dirStore = db.createObjectStore('directory_employees', { keyPath: 'id' });
            dirStore.createIndex('by_employeeId', 'employeeId', { unique: true });
            dirStore.createIndex('by_department', 'department', { unique: false });
            dirStore.createIndex('by_status', 'employmentStatus', { unique: false });
          }

          if (!db.objectStoreNames.contains('employee_documents')) {
            const docStore = db.createObjectStore('employee_documents', { keyPath: 'id' });
            docStore.createIndex('by_employeeId', 'employeeId', { unique: false });
            docStore.createIndex('by_category', 'category', { unique: false });
          }

          if (!db.objectStoreNames.contains('custom_fields')) {
            db.createObjectStore('custom_fields', { keyPath: 'id' });
          }

          if (!db.objectStoreNames.contains('import_configurations')) {
            db.createObjectStore('import_configurations', { keyPath: 'id' });
          }

          if (!db.objectStoreNames.contains('import_history')) {
            db.createObjectStore('import_history', { keyPath: 'id' });
          }
        };

        request.onsuccess = (event) => {
          clearTimeout(timer);
          this.db = (event.target as IDBOpenDBRequest).result;
          resolve(this.db);
        };

        request.onerror = () => {
          clearTimeout(timer);
          resolve(null);
        };

        request.onblocked = () => {
          clearTimeout(timer);
          resolve(null);
        };
      } catch {
        clearTimeout(timer);
        resolve(null);
      }
    });
  }

  private async getDB(): Promise<IDBDatabase | null> {
    if (this.db) return this.db;
    return await this.isReadyPromise;
  }

  // --- SETTINGS ---
  async getSettings(): Promise<CompanySettings> {
    try {
      const local = localStorage.getItem('payslip_studio_settings');
      if (local) {
        try {
          return { ...DEFAULT_COMPANY_SETTINGS, ...JSON.parse(local) };
        } catch {
          // ignore
        }
      }

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('settings')) {
        return DEFAULT_COMPANY_SETTINGS;
      }

      return new Promise((resolve) => {
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const req = store.get('company_settings');
        req.onsuccess = () => {
          if (req.result && req.result.data) {
            resolve({ ...DEFAULT_COMPANY_SETTINGS, ...req.result.data });
          } else {
            resolve(DEFAULT_COMPANY_SETTINGS);
          }
        };
        req.onerror = () => resolve(DEFAULT_COMPANY_SETTINGS);
      });
    } catch {
      return DEFAULT_COMPANY_SETTINGS;
    }
  }

  async saveSettings(settings: CompanySettings): Promise<void> {
    try {
      localStorage.setItem('payslip_studio_settings', JSON.stringify(settings));
      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('settings')) return;

      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      store.put({ id: 'company_settings', data: settings });
    } catch (e) {
      console.warn('Settings persistence error:', e);
    }
  }

  // --- LAYOUT SETTINGS ---
  async getLayoutSettings(): Promise<PayslipLayoutSettings> {
    try {
      const local = localStorage.getItem('payslip_studio_layout');
      if (local) {
        try {
          return { ...DEFAULT_LAYOUT_SETTINGS, ...JSON.parse(local) };
        } catch {
          // ignore
        }
      }
      return DEFAULT_LAYOUT_SETTINGS;
    } catch {
      return DEFAULT_LAYOUT_SETTINGS;
    }
  }

  async saveLayoutSettings(layout: PayslipLayoutSettings): Promise<void> {
    try {
      localStorage.setItem('payslip_studio_layout', JSON.stringify(layout));
    } catch (e) {
      console.warn('Layout persistence error:', e);
    }
  }

  // --- EMAIL SETTINGS ---
  async getEmailSettings(): Promise<EmailSettings> {
    try {
      const local = localStorage.getItem('payslip_studio_email');
      if (local) {
        try {
          return { ...DEFAULT_EMAIL_SETTINGS, ...JSON.parse(local) };
        } catch {
          // ignore
        }
      }
      return DEFAULT_EMAIL_SETTINGS;
    } catch {
      return DEFAULT_EMAIL_SETTINGS;
    }
  }

  async saveEmailSettings(emailConfig: EmailSettings): Promise<void> {
    try {
      localStorage.setItem('payslip_studio_email', JSON.stringify(emailConfig));
    } catch (e) {
      console.warn('Email config persistence error:', e);
    }
  }

  // --- EMPLOYEE RECORDS ---
  async getEmployees(): Promise<EmployeeRecord[]> {
    try {
      const local = localStorage.getItem('payslip_studio_employees');
      if (local) {
        try {
          return JSON.parse(local);
        } catch {
          // ignore
        }
      }

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('employee_records')) {
        return [];
      }

      return new Promise((resolve) => {
        const tx = db.transaction('employee_records', 'readonly');
        const store = tx.objectStore('employee_records');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async saveEmployees(employees: EmployeeRecord[]): Promise<void> {
    try {
      localStorage.setItem('payslip_studio_employees', JSON.stringify(employees));
      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('employee_records')) return;

      const tx = db.transaction('employee_records', 'readwrite');
      const store = tx.objectStore('employee_records');
      store.clear();
      employees.forEach(emp => store.put(emp));
    } catch (e) {
      console.warn('Could not save employees:', e);
    }
  }

  async clearEmployees(): Promise<void> {
    try {
      localStorage.removeItem('payslip_studio_employees');
      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('employee_records')) return;

      const tx = db.transaction('employee_records', 'readwrite');
      const store = tx.objectStore('employee_records');
      store.clear();
    } catch (e) {
      console.warn('Could not clear employees:', e);
    }
  }

  // --- GENERATED HISTORY ---
  async getHistory(): Promise<GeneratedPayslipRecord[]> {
    try {
      const local = localStorage.getItem('payslip_studio_history');
      if (local) {
        try {
          const list: GeneratedPayslipRecord[] = JSON.parse(local);
          list.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
          return list;
        } catch {
          // ignore
        }
      }

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('generated_history')) {
        return [];
      }

      return new Promise((resolve) => {
        const tx = db.transaction('generated_history', 'readonly');
        const store = tx.objectStore('generated_history');
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async saveGeneratedRecord(record: GeneratedPayslipRecord): Promise<void> {
    try {
      const current = await this.getHistory();
      const updated = [record, ...current.filter(c => c.id !== record.id)];
      localStorage.setItem('payslip_studio_history', JSON.stringify(updated));

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('generated_history')) return;

      const tx = db.transaction('generated_history', 'readwrite');
      const store = tx.objectStore('generated_history');
      store.put(record);
    } catch (e) {
      console.warn('Could not save history record:', e);
    }
  }

  async clearHistory(): Promise<void> {
    try {
      localStorage.removeItem('payslip_studio_history');
      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('generated_history')) return;

      const tx = db.transaction('generated_history', 'readwrite');
      const store = tx.objectStore('generated_history');
      store.clear();
    } catch (e) {
      console.warn('Could not clear history:', e);
    }
  }

  // --- EMPLOYEE DIRECTORY (HR MASTER) ---
  async getDirectoryEmployees(): Promise<DirectoryEmployee[]> {
    try {
      const local = localStorage.getItem('payslip_studio_directory_employees');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        } catch {
          // ignore
        }
      }

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('directory_employees')) {
        return SEED_DIRECTORY_EMPLOYEES;
      }

      return new Promise((resolve) => {
        const tx = db.transaction('directory_employees', 'readonly');
        const store = tx.objectStore('directory_employees');
        const req = store.getAll();
        req.onsuccess = () => {
          const res = req.result || [];
          if (res.length === 0) {
            // Seed initial verified directory employees
            this.saveAllDirectoryEmployees(SEED_DIRECTORY_EMPLOYEES).catch(() => {});
            resolve(SEED_DIRECTORY_EMPLOYEES);
          } else {
            resolve(res);
          }
        };
        req.onerror = () => resolve(SEED_DIRECTORY_EMPLOYEES);
      });
    } catch {
      return SEED_DIRECTORY_EMPLOYEES;
    }
  }

  async saveDirectoryEmployee(emp: DirectoryEmployee): Promise<void> {
    try {
      const current = await this.getDirectoryEmployees();
      const existingIdx = current.findIndex(e => e.id === emp.id || e.employeeId === emp.employeeId);
      let updated: DirectoryEmployee[];
      if (existingIdx >= 0) {
        updated = [...current];
        updated[existingIdx] = emp;
      } else {
        updated = [emp, ...current];
      }

      localStorage.setItem('payslip_studio_directory_employees', JSON.stringify(updated));

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('directory_employees')) return;

      const tx = db.transaction('directory_employees', 'readwrite');
      const store = tx.objectStore('directory_employees');
      store.put(emp);
    } catch (e) {
      console.warn('Could not save directory employee:', e);
    }
  }

  async saveAllDirectoryEmployees(employees: DirectoryEmployee[]): Promise<void> {
    try {
      localStorage.setItem('payslip_studio_directory_employees', JSON.stringify(employees));
      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('directory_employees')) return;

      const tx = db.transaction('directory_employees', 'readwrite');
      const store = tx.objectStore('directory_employees');
      employees.forEach(emp => store.put(emp));
    } catch (e) {
      console.warn('Could not bulk save directory employees:', e);
    }
  }

  async deleteDirectoryEmployee(id: string): Promise<void> {
    try {
      const current = await this.getDirectoryEmployees();
      const emp = current.find(e => e.id === id);
      const updated = current.filter(e => e.id !== id);
      localStorage.setItem('payslip_studio_directory_employees', JSON.stringify(updated));

      // Also clean up associated documents from local store
      if (emp) {
        const allDocs = await this.getEmployeeDocuments();
        const remainingDocs = allDocs.filter(d => d.employeeId !== emp.employeeId);
        localStorage.setItem('payslip_studio_employee_documents', JSON.stringify(remainingDocs));
      }

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('directory_employees')) return;

      const tx = db.transaction('directory_employees', 'readwrite');
      const store = tx.objectStore('directory_employees');
      store.delete(id);
    } catch (e) {
      console.warn('Could not delete directory employee:', e);
    }
  }

  // --- EMPLOYEE DOCUMENTS ---
  async getEmployeeDocuments(employeeId?: string): Promise<EmployeeDocument[]> {
    try {
      const local = localStorage.getItem('payslip_studio_employee_documents');
      let allDocs: EmployeeDocument[] = [];
      if (local) {
        try {
          allDocs = JSON.parse(local);
        } catch {
          // ignore
        }
      }

      if (allDocs.length === 0) {
        const db = await this.getDB();
        if (db && db.objectStoreNames.contains('employee_documents')) {
          allDocs = await new Promise<EmployeeDocument[]>((resolve) => {
            const tx = db.transaction('employee_documents', 'readonly');
            const store = tx.objectStore('employee_documents');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });
        }
      }

      if (allDocs.length === 0) {
        allDocs = SEED_EMPLOYEE_DOCUMENTS;
        this.saveAllEmployeeDocuments(SEED_EMPLOYEE_DOCUMENTS).catch(() => {});
      }

      if (employeeId) {
        return allDocs.filter(d => d.employeeId === employeeId);
      }
      return allDocs;
    } catch {
      return employeeId ? SEED_EMPLOYEE_DOCUMENTS.filter(d => d.employeeId === employeeId) : SEED_EMPLOYEE_DOCUMENTS;
    }
  }

  async saveEmployeeDocument(doc: EmployeeDocument): Promise<void> {
    try {
      const current = await this.getEmployeeDocuments();
      const existingIdx = current.findIndex(d => d.id === doc.id);
      let updated: EmployeeDocument[];
      if (existingIdx >= 0) {
        updated = [...current];
        updated[existingIdx] = doc;
      } else {
        updated = [doc, ...current];
      }

      localStorage.setItem('payslip_studio_employee_documents', JSON.stringify(updated));

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('employee_documents')) return;

      const tx = db.transaction('employee_documents', 'readwrite');
      const store = tx.objectStore('employee_documents');
      store.put(doc);
    } catch (e) {
      console.warn('Could not save employee document:', e);
    }
  }

  async saveAllEmployeeDocuments(docs: EmployeeDocument[]): Promise<void> {
    try {
      localStorage.setItem('payslip_studio_employee_documents', JSON.stringify(docs));
      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('employee_documents')) return;

      const tx = db.transaction('employee_documents', 'readwrite');
      const store = tx.objectStore('employee_documents');
      docs.forEach(doc => store.put(doc));
    } catch (e) {
      console.warn('Could not bulk save employee documents:', e);
    }
  }

  async deleteEmployeeDocument(id: string): Promise<void> {
    try {
      const current = await this.getEmployeeDocuments();
      const updated = current.filter(d => d.id !== id);
      localStorage.setItem('payslip_studio_employee_documents', JSON.stringify(updated));

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('employee_documents')) return;

      const tx = db.transaction('employee_documents', 'readwrite');
      const store = tx.objectStore('employee_documents');
      store.delete(id);
    } catch (e) {
      console.warn('Could not delete employee document:', e);
    }
  }

  // --- CUSTOM FIELD DEFINITIONS ---
  async getCustomFields(): Promise<CustomFieldDefinition[]> {
    try {
      const local = localStorage.getItem('payslip_studio_custom_fields');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // ignore
        }
      }

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('custom_fields')) {
        return [];
      }

      return new Promise((resolve) => {
        const tx = db.transaction('custom_fields', 'readonly');
        const store = tx.objectStore('custom_fields');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async saveCustomField(field: CustomFieldDefinition): Promise<void> {
    try {
      const current = await this.getCustomFields();
      const existingIdx = current.findIndex(f => f.id === field.id || f.key === field.key);
      let updated: CustomFieldDefinition[];
      if (existingIdx >= 0) {
        updated = [...current];
        updated[existingIdx] = field;
      } else {
        updated = [...current, field];
      }
      localStorage.setItem('payslip_studio_custom_fields', JSON.stringify(updated));

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('custom_fields')) return;

      const tx = db.transaction('custom_fields', 'readwrite');
      const store = tx.objectStore('custom_fields');
      store.put(field);
    } catch (e) {
      console.warn('Could not save custom field definition:', e);
    }
  }

  async saveAllCustomFields(fields: CustomFieldDefinition[]): Promise<void> {
    try {
      localStorage.setItem('payslip_studio_custom_fields', JSON.stringify(fields));
      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('custom_fields')) return;

      const tx = db.transaction('custom_fields', 'readwrite');
      const store = tx.objectStore('custom_fields');
      fields.forEach(f => store.put(f));
    } catch (e) {
      console.warn('Could not save all custom fields:', e);
    }
  }

  async deleteCustomField(id: string): Promise<void> {
    try {
      const current = await this.getCustomFields();
      const updated = current.filter(f => f.id !== id && f.key !== id);
      localStorage.setItem('payslip_studio_custom_fields', JSON.stringify(updated));

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('custom_fields')) return;

      const tx = db.transaction('custom_fields', 'readwrite');
      const store = tx.objectStore('custom_fields');
      store.delete(id);
    } catch (e) {
      console.warn('Could not delete custom field:', e);
    }
  }

  // --- SAVED IMPORT CONFIGURATIONS ---
  async getSavedImportConfigs(): Promise<SavedImportConfig[]> {
    try {
      const local = localStorage.getItem('payslip_studio_import_configs');
      if (local) {
        try {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // ignore
        }
      }

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('import_configurations')) {
        return [];
      }

      return new Promise((resolve) => {
        const tx = db.transaction('import_configurations', 'readonly');
        const store = tx.objectStore('import_configurations');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async saveImportConfig(config: SavedImportConfig): Promise<void> {
    try {
      const current = await this.getSavedImportConfigs();
      const existingIdx = current.findIndex(c => c.id === config.id || c.name.toLowerCase() === config.name.toLowerCase());
      let updated: SavedImportConfig[];
      if (existingIdx >= 0) {
        updated = [...current];
        updated[existingIdx] = config;
      } else {
        updated = [config, ...current];
      }
      localStorage.setItem('payslip_studio_import_configs', JSON.stringify(updated));

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('import_configurations')) return;

      const tx = db.transaction('import_configurations', 'readwrite');
      const store = tx.objectStore('import_configurations');
      store.put(config);
    } catch (e) {
      console.warn('Could not save import configuration:', e);
    }
  }

  async deleteImportConfig(id: string): Promise<void> {
    try {
      const current = await this.getSavedImportConfigs();
      const updated = current.filter(c => c.id !== id);
      localStorage.setItem('payslip_studio_import_configs', JSON.stringify(updated));

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('import_configurations')) return;

      const tx = db.transaction('import_configurations', 'readwrite');
      const store = tx.objectStore('import_configurations');
      store.delete(id);
    } catch (e) {
      console.warn('Could not delete import configuration:', e);
    }
  }

  // --- IMPORT AUDIT HISTORY ---
  async getImportHistory(): Promise<ImportHistoryRecord[]> {
    try {
      const local = localStorage.getItem('payslip_studio_import_history');
      if (local) {
        try {
          const list: ImportHistoryRecord[] = JSON.parse(local);
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          return list;
        } catch {
          // ignore
        }
      }

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('import_history')) {
        return [];
      }

      return new Promise((resolve) => {
        const tx = db.transaction('import_history', 'readonly');
        const store = tx.objectStore('import_history');
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          resolve(list);
        };
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  async saveImportHistoryRecord(record: ImportHistoryRecord): Promise<void> {
    try {
      const current = await this.getImportHistory();
      const updated = [record, ...current.filter(c => c.id !== record.id)];
      localStorage.setItem('payslip_studio_import_history', JSON.stringify(updated));

      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('import_history')) return;

      const tx = db.transaction('import_history', 'readwrite');
      const store = tx.objectStore('import_history');
      store.put(record);
    } catch (e) {
      console.warn('Could not save import history record:', e);
    }
  }

  async clearImportHistory(): Promise<void> {
    try {
      localStorage.removeItem('payslip_studio_import_history');
      const db = await this.getDB();
      if (!db || !db.objectStoreNames.contains('import_history')) return;

      const tx = db.transaction('import_history', 'readwrite');
      const store = tx.objectStore('import_history');
      store.clear();
    } catch (e) {
      console.warn('Could not clear import history:', e);
    }
  }

  // --- FULL DATABASE BACKUP & RESTORE ---
  async exportFullBackup(): Promise<string> {
    const settings = await this.getSettings();
    const employees = await this.getEmployees();
    const history = await this.getHistory();
    const directoryEmployees = await this.getDirectoryEmployees();
    const documents = await this.getEmployeeDocuments();
    const layout = await this.getLayoutSettings();
    const email = await this.getEmailSettings();
    const customFields = await this.getCustomFields();
    const importConfigs = await this.getSavedImportConfigs();
    const importHistory = await this.getImportHistory();

    const backupData = {
      app: 'PeopleDesk Studio',
      version: '1.2.0',
      exportedAt: new Date().toISOString(),
      platform: 'Windows Desktop / Local',
      storageLocation: '%APPDATA%/PeopleDeskStudio/database.sqlite',
      data: {
        settings,
        employees,
        history,
        directoryEmployees,
        documents,
        layout,
        email,
        customFields,
        importConfigs,
        importHistory
      }
    };

    return JSON.stringify(backupData, null, 2);
  }

  async importFullBackup(jsonContent: string): Promise<{ success: boolean; message: string }> {
    try {
      const parsed = JSON.parse(jsonContent);
      if (!parsed.data) {
        return { success: false, message: 'Invalid backup file structure.' };
      }

      if (parsed.data.settings) {
        await this.saveSettings(parsed.data.settings);
      }
      if (Array.isArray(parsed.data.employees)) {
        await this.saveEmployees(parsed.data.employees);
      }
      if (Array.isArray(parsed.data.history)) {
        for (const h of parsed.data.history) {
          await this.saveGeneratedRecord(h);
        }
      }
      if (Array.isArray(parsed.data.directoryEmployees)) {
        await this.saveAllDirectoryEmployees(parsed.data.directoryEmployees);
      }
      if (Array.isArray(parsed.data.documents)) {
        await this.saveAllEmployeeDocuments(parsed.data.documents);
      }
      if (parsed.data.layout) {
        await this.saveLayoutSettings(parsed.data.layout);
      }
      if (parsed.data.email) {
        await this.saveEmailSettings(parsed.data.email);
      }
      if (Array.isArray(parsed.data.customFields)) {
        await this.saveAllCustomFields(parsed.data.customFields);
      }
      if (Array.isArray(parsed.data.importConfigs)) {
        for (const cfg of parsed.data.importConfigs) {
          await this.saveImportConfig(cfg);
        }
      }
      if (Array.isArray(parsed.data.importHistory)) {
        for (const h of parsed.data.importHistory) {
          await this.saveImportHistoryRecord(h);
        }
      }

      return {
        success: true,
        message: `Successfully restored database: ${parsed.data.directoryEmployees?.length || 0} master employees, ${parsed.data.employees?.length || 0} payroll batch records, and ${parsed.data.history?.length || 0} history records.`
      };
    } catch (err: any) {
      return { success: false, message: `Failed to restore database: ${err.message}` };
    }
  }
}

export const localDB = new LocalDatabase();

