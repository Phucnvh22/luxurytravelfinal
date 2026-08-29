import type { AdminRequestSummary } from '../types'

export type AdminModule = {
  label: string
  description: string
  to: string
  badge?: number
  tone: 'emerald' | 'violet' | 'cyan' | 'amber'
}

export function buildAdminModules(requestSummary: AdminRequestSummary | null): AdminModule[] {
  const pendingRequests = requestSummary?.totalPendingRequests ?? 0

  return [
    {
      label: 'Overview',
      description: 'Admin summary and website preview',
      to: '/admin',
      tone: 'emerald',
    },
    {
      label: 'Room schedule',
      description: 'Monthly room calendar and guest flow',
      to: '/admin/room-bookings',
      tone: 'violet',
    },
    {
      label: 'Cleaning history',
      description: 'Review room cleaning history by villa',
      to: '/admin/room-cleaning-history',
      tone: 'amber',
    },
    {
      label: 'Repair history',
      description: 'Review room repair history by villa',
      to: '/admin/room-repair-history',
      tone: 'violet',
    },
    {
      label: 'Rooms',
      description: 'Manage room inventory and room metadata',
      to: '/admin/rooms',
      tone: 'cyan',
    },
    {
      label: 'Direct bookings',
      description: 'Review direct website booking requests',
      to: '/admin/bookings',
      tone: 'amber',
    },
    {
      label: 'Service requests',
      description: 'Approve transport and travel services',
      to: '/admin/service-requests',
      badge: requestSummary?.pendingServiceRequests,
      tone: 'emerald',
    },
    {
      label: 'Experience requests',
      description: 'Approve tours and experience requests',
      to: '/admin/experience-requests',
      badge: requestSummary?.pendingExperienceRequests,
      tone: 'violet',
    },
    {
      label: 'Destinations',
      description: 'Edit destination cards shown on the website',
      to: '/admin/destinations',
      tone: 'cyan',
    },
    {
      label: 'Services',
      description: 'Manage service products and media',
      to: '/admin/services',
      tone: 'amber',
    },
    {
      label: 'Experiences',
      description: 'Manage experience cards and details',
      to: '/admin/experiences',
      tone: 'emerald',
    },
    {
      label: 'Users',
      description: 'Control user accounts and permissions',
      to: '/admin/users',
      tone: 'cyan',
    },
    {
      label: 'Cleaner assignments',
      description: 'Assign cleaners to villas and review workload',
      to: '/admin/cleaners',
      tone: 'emerald',
    },
    {
      label: 'Sellers',
      description: 'Track seller accounts and commission',
      to: '/admin/sellers',
      tone: 'violet',
    },
    {
      label: 'Customer website',
      description: pendingRequests > 0 ? `Preview live site with ${pendingRequests} pending requests in mind` : 'Preview the public website as a customer',
      to: '/?customerPreview=1',
      tone: 'amber',
    },
  ]
}
