import type { AdminRequestSummary } from '../types'

export type AdminModule = {
  label: string
  description: string
  to: string
  badge?: number
  group: 'screens' | 'booking' | 'content' | 'preview'
  tone: 'emerald' | 'violet' | 'cyan' | 'amber'
}

export function buildAdminModules(requestSummary: AdminRequestSummary | null): AdminModule[] {
  const pendingRequests = requestSummary?.totalPendingRequests ?? 0

  return [
    {
      label: 'Overview',
      description: 'Admin summary and website preview',
      to: '/admin',
      group: 'screens',
      tone: 'emerald',
    },
    {
      label: 'Villa schedule',
      description: 'Monthly villa calendar and guest flow',
      to: '/admin/room-bookings',
      group: 'screens',
      tone: 'violet',
    },
    {
      label: 'Cleaning history',
      description: 'Review villa cleaning history',
      to: '/admin/room-cleaning-history',
      group: 'screens',
      tone: 'amber',
    },
    {
      label: 'Repair history',
      description: 'Review villa repair history',
      to: '/admin/room-repair-history',
      group: 'screens',
      tone: 'violet',
    },
    {
      label: 'Villas',
      description: 'Manage villa inventory and villa details',
      to: '/admin/rooms',
      group: 'screens',
      tone: 'cyan',
    },
    {
      label: 'Villa areas',
      description: 'Manage villa areas and grouping',
      to: '/admin/room-areas',
      group: 'screens',
      tone: 'amber',
    },
    {
      label: 'Villa settings',
      description: 'Manage villa types and hosts used in villa forms',
      to: '/admin/villa-settings',
      group: 'screens',
      tone: 'violet',
    },
    {
      label: 'Villa services',
      description: 'Manage operational services and service orders',
      to: '/admin/villa-services',
      group: 'screens',
      tone: 'emerald',
    },
    {
      label: 'Direct bookings',
      description: 'Review direct website booking requests',
      to: '/admin/bookings',
      group: 'booking',
      tone: 'amber',
    },
    {
      label: 'Service requests',
      description: 'Approve transport and travel services',
      to: '/admin/service-requests',
      badge: requestSummary?.pendingServiceRequests,
      group: 'booking',
      tone: 'emerald',
    },
    {
      label: 'Experience requests',
      description: 'Approve tours and experience requests',
      to: '/admin/experience-requests',
      badge: requestSummary?.pendingExperienceRequests,
      group: 'booking',
      tone: 'violet',
    },
    {
      label: 'Destinations',
      description: 'Edit destination cards shown on the website',
      to: '/admin/destinations',
      group: 'content',
      tone: 'cyan',
    },
    {
      label: 'Services',
      description: 'Manage service products and media',
      to: '/admin/services',
      group: 'content',
      tone: 'amber',
    },
    {
      label: 'Experiences',
      description: 'Manage experience cards and details',
      to: '/admin/experiences',
      group: 'content',
      tone: 'emerald',
    },
    {
      label: 'Users',
      description: 'Control user accounts and permissions',
      to: '/admin/users',
      group: 'content',
      tone: 'cyan',
    },
    {
      label: 'Cleaner assignments',
      description: 'Assign cleaners to villas and review workload',
      to: '/admin/cleaners',
      group: 'content',
      tone: 'emerald',
    },
    {
      label: 'Sellers',
      description: 'Track seller accounts and commission',
      to: '/admin/sellers',
      group: 'content',
      tone: 'violet',
    },
    {
      label: 'Customer website',
      description: pendingRequests > 0 ? `Preview live site with ${pendingRequests} pending requests in mind` : 'Preview the public website as a customer',
      to: '/?customerPreview=1',
      group: 'preview',
      tone: 'amber',
    },
  ]
}
