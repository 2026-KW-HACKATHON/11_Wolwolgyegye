import type { SpaceRentalSpace } from './types';

/** storeId 는 core/mock/stores.ts 의 가게 id 와 맞춰서 쓴다 */
export const MOCK_SPACES: SpaceRentalSpace[] = [
  {
    id: 'space-003-1',
    storeId: 'store-003',
    name: '2인실',
    pricePerHour: 5000,
    timeSlots: ['10:00-12:00', '14:00-16:00'],
  },
  {
    id: 'space-003-2',
    storeId: 'store-003',
    name: '4인실',
    pricePerHour: 9000,
    timeSlots: ['13:00-15:00', '18:00-20:00'],
  },
];