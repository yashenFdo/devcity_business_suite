import { lazy, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthGate } from './components/auth/AuthGate';
import { RequirePermission } from './components/auth/RequirePermission';
import { AppLayout } from './components/layout/AppLayout';
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));

const QuotationsList = lazy(() => import('./pages/quotations/QuotationsList').then((m) => ({ default: m.QuotationsList })));
const QuotationCreate = lazy(() => import('./pages/quotations/QuotationCreate').then((m) => ({ default: m.QuotationCreate })));
const QuotationView = lazy(() => import('./pages/quotations/QuotationView').then((m) => ({ default: m.QuotationView })));

const InvoicesList = lazy(() => import('./pages/invoices/InvoicesList').then((m) => ({ default: m.InvoicesList })));
const InvoiceCreate = lazy(() => import('./pages/invoices/InvoiceCreate').then((m) => ({ default: m.InvoiceCreate })));
const InvoiceView = lazy(() => import('./pages/invoices/InvoiceView').then((m) => ({ default: m.InvoiceView })));

const BillsList = lazy(() => import('./pages/bills/BillsList').then((m) => ({ default: m.BillsList })));
const BillCreate = lazy(() => import('./pages/bills/BillCreate').then((m) => ({ default: m.BillCreate })));
const BillView = lazy(() => import('./pages/bills/BillView').then((m) => ({ default: m.BillView })));

const ReceiptsList = lazy(() => import('./pages/receipts/ReceiptsList').then((m) => ({ default: m.ReceiptsList })));
const ReceiptCreate = lazy(() => import('./pages/receipts/ReceiptCreate').then((m) => ({ default: m.ReceiptCreate })));
const ReceiptView = lazy(() => import('./pages/receipts/ReceiptView').then((m) => ({ default: m.ReceiptView })));

const CustomersList = lazy(() => import('./pages/customers/CustomersList').then((m) => ({ default: m.CustomersList })));

const SettingsLayout = lazy(() => import('./pages/settings/SettingsLayout').then((m) => ({ default: m.SettingsLayout })));
const CompanySettings = lazy(() => import('./pages/settings/CompanySettings').then((m) => ({ default: m.CompanySettings })));
const BrandingSettings = lazy(() => import('./pages/settings/BrandingSettings').then((m) => ({ default: m.BrandingSettings })));
const SignaturesSettings = lazy(() => import('./pages/settings/SignaturesSettings').then((m) => ({ default: m.SignaturesSettings })));
const TeamSettings = lazy(() => import('./pages/settings/TeamSettings').then((m) => ({ default: m.TeamSettings })));
const SecuritySettings = lazy(() => import('./pages/settings/SecuritySettings').then((m) => ({ default: m.SecuritySettings })));
const PeopleDirectory = lazy(() => import('./pages/people/PeopleDirectory').then((m) => ({ default: m.PeopleDirectory })));
const ActivityLog = lazy(() => import('./pages/settings/ActivityLog').then((m) => ({ default: m.ActivityLog })));

const create = (el: ReactNode) => <RequirePermission permission="documents.create">{el}</RequirePermission>;
const edit = (el: ReactNode) => <RequirePermission permission="documents.edit">{el}</RequirePermission>;

function App() {
  return (
    <>
      <Toaster
        position="bottom-right"
        gutter={10}
        toastOptions={{
          duration: 3500,
          style: {
            fontFamily: '"Inter Variable", Inter, sans-serif',
            fontSize: '13px',
            color: '#0f172a',
            borderRadius: '12px',
            padding: '10px 14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 12px 32px -8px rgb(15 23 42 / 0.18)',
          },
          success: { iconTheme: { primary: '#059669', secondary: 'white' } },
          error: { iconTheme: { primary: '#e11d48', secondary: 'white' } },
        }}
      />
      <BrowserRouter>
        <AuthGate>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />

              <Route path="/quotations" element={<QuotationsList />} />
              <Route path="/quotations/new" element={create(<QuotationCreate />)} />
              <Route path="/quotations/:id" element={<QuotationView />} />
              <Route path="/quotations/:id/edit" element={edit(<QuotationCreate editMode />)} />

              <Route path="/invoices" element={<InvoicesList />} />
              <Route path="/invoices/new" element={create(<InvoiceCreate />)} />
              <Route path="/invoices/:id" element={<InvoiceView />} />
              <Route path="/invoices/:id/edit" element={edit(<InvoiceCreate editMode />)} />

              <Route path="/bills" element={<BillsList />} />
              <Route path="/bills/new" element={create(<BillCreate />)} />
              <Route path="/bills/:id" element={<BillView />} />
              <Route path="/bills/:id/edit" element={edit(<BillCreate editMode />)} />

              <Route path="/receipts" element={<ReceiptsList />} />
              <Route
                path="/receipts/new"
                element={
                  <RequirePermission permission="payments.record">
                    <ReceiptCreate />
                  </RequirePermission>
                }
              />
              <Route path="/receipts/:id" element={<ReceiptView />} />
              <Route path="/receipts/:id/edit" element={edit(<ReceiptCreate editMode />)} />

              <Route path="/customers" element={<CustomersList />} />
              <Route path="/people" element={<PeopleDirectory />} />

              <Route path="/settings" element={<SettingsLayout />}>
                <Route
                  index
                  element={
                    <RequirePermission permission="settings.manage">
                      <CompanySettings />
                    </RequirePermission>
                  }
                />
                <Route
                  path="branding"
                  element={
                    <RequirePermission permission="settings.manage">
                      <BrandingSettings />
                    </RequirePermission>
                  }
                />
                <Route path="signatures" element={<SignaturesSettings />} />
                <Route
                  path="team"
                  element={
                    <RequirePermission permission="users.manage">
                      <TeamSettings />
                    </RequirePermission>
                  }
                />
                <Route path="security" element={<SecuritySettings />} />
                <Route
                  path="activity"
                  element={
                    <RequirePermission permission="audit.view">
                      <ActivityLog />
                    </RequirePermission>
                  }
                />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthGate>
      </BrowserRouter>
    </>
  );
}

export default App;
