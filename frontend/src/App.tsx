import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useUIStore } from '@/store/uiStore'
import { useThemeStore, applyStoredTheme } from '@/store/themeStore'
import i18n from '@/i18n'
import clsx from 'clsx'

// Apply stored theme before first render
applyStoredTheme()

import RTLWrapper      from '@/components/layout/RTLWrapper'
import ProtectedRoute  from '@/components/layout/ProtectedRoute'
import Sidebar         from '@/components/layout/Sidebar'
import TopBar          from '@/components/layout/TopBar'

import Login           from '@/pages/Login'
import Dashboard       from '@/pages/Dashboard'
import Clients         from '@/pages/Clients'
import ClientProfile   from '@/pages/Clients/profile'
import Accounting      from '@/pages/Accounting'
import Invoices        from '@/pages/Invoices'
import InvoiceEdit     from '@/pages/Invoices/edit'
import ShippingAgents       from '@/pages/ShippingAgents'
import ShippingAgentProfile from '@/pages/ShippingAgents/profile'
import ClearanceAgents from '@/pages/ClearanceAgents'
import ClearanceAgentProfile from '@/pages/ClearanceAgents/profile'
import CustomsCalculator from '@/pages/CustomsCalculator'
import CustomsReferences from '@/pages/CustomsReferences'
import Market          from '@/pages/Market'
import Users           from '@/pages/Users'
import Company         from '@/pages/Company'
import Portal          from '@/pages/Portal'
import Containers      from '@/pages/Containers'
import ContainerDetail from '@/pages/Containers/detail'
import Warehouses      from '@/pages/Warehouses'
import Suppliers       from '@/pages/Suppliers'
import Products        from '@/pages/Products'
import BulkImport      from '@/pages/Products/BulkImport'
import ShopHome        from '@/pages/Shop'
import ShopProducts    from '@/pages/Shop/products'
import ProductDetail   from '@/pages/Shop/product'
import ShopProfile     from '@/pages/Shop/profile'
import ShopAbout       from '@/pages/Shop/about'
import ShopContact     from '@/pages/Shop/contact'
import ShopHowItWorks  from '@/pages/Shop/how-it-works'
import ShopCalculator  from '@/pages/Shop/calculator'
import ClientLogin     from '@/pages/Shop/client-login'
import ClientPortal    from '@/pages/Shop/client-portal'

function AppLayout({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, lang } = useUIStore()
  const isRTL = lang === 'ar'
  const offset = sidebarOpen ? 'md:ps-64' : 'md:ps-16'

  return (
    <div className={clsx('flex h-screen overflow-hidden bg-brand-bg', isRTL ? 'flex-row-reverse' : 'flex-row')}>
      <Sidebar />
      <div className={clsx('flex-1 flex flex-col overflow-hidden transition-all duration-300', offset)}>
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const { lang }   = useUIStore()
  const { themeId } = useThemeStore()

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr'
    i18n.changeLanguage(lang)
  }, [lang])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId)
  }, [themeId])

  return (
    <RTLWrapper>
      <BrowserRouter>
        <Routes>
          <Route path="/login"           element={<Login />} />
          <Route path="/market/tv"       element={<Portal />} />
          <Route path="/shop"               element={<ShopHome />} />
          <Route path="/shop/products"      element={<ShopProducts />} />
          <Route path="/shop/product/:id"   element={<ProductDetail />} />
          <Route path="/shop/profile"       element={<ShopProfile />} />
          <Route path="/shop/about"         element={<ShopAbout />} />
          <Route path="/shop/contact"       element={<ShopContact />} />
          <Route path="/shop/how-it-works"  element={<ShopHowItWorks />} />
          <Route path="/shop/calculator"    element={<ShopCalculator />} />
          <Route path="/shop/client-login"  element={<ClientLogin />} />
          <Route path="/shop/client-portal" element={<ClientPortal />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/"                    element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"           element={<AppLayout><Dashboard /></AppLayout>} />
            <Route path="/clients"             element={<AppLayout><Clients /></AppLayout>} />
            <Route path="/clients/:id"         element={<AppLayout><ClientProfile /></AppLayout>} />
            <Route path="/accounting"          element={<AppLayout><Accounting /></AppLayout>} />
            <Route path="/invoices"            element={<AppLayout><Invoices /></AppLayout>} />
            <Route path="/invoices/:id/edit"   element={<AppLayout><InvoiceEdit /></AppLayout>} />
            <Route path="/shipping-agents"          element={<AppLayout><ShippingAgents /></AppLayout>} />
            <Route path="/shipping-agents/:id"     element={<AppLayout><ShippingAgentProfile /></AppLayout>} />
            <Route path="/clearance-agents"    element={<AppLayout><ClearanceAgents /></AppLayout>} />
            <Route path="/clearance-agents/:id" element={<AppLayout><ClearanceAgentProfile /></AppLayout>} />
            <Route path="/customs-calculator"  element={<AppLayout><CustomsCalculator /></AppLayout>} />
            <Route path="/customs-references"  element={<AppLayout><CustomsReferences /></AppLayout>} />
            <Route path="/market"              element={<AppLayout><Market /></AppLayout>} />
            <Route path="/containers"          element={<AppLayout><Containers /></AppLayout>} />
            <Route path="/containers/:id"      element={<AppLayout><ContainerDetail /></AppLayout>} />
            <Route path="/users"               element={<AppLayout><Users /></AppLayout>} />
            <Route path="/company"             element={<AppLayout><Company /></AppLayout>} />
            <Route path="/warehouses"          element={<AppLayout><Warehouses /></AppLayout>} />
            <Route path="/suppliers"              element={<AppLayout><Suppliers /></AppLayout>} />
            <Route path="/products"               element={<AppLayout><Products /></AppLayout>} />
            <Route path="/products/bulk-import"   element={<AppLayout><BulkImport /></AppLayout>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </RTLWrapper>
  )
}
