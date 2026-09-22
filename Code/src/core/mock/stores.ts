import type { Store } from "../types/place";

/**
 * 개발용 임시 데이터 (5개).
 * Supabase 연동 전까지 각 카테고리 화면에서 이 배열을 데이터인 것처럼 쓴다.
 * 실제 연동 시에는 이 파일 대신 DB에서 값을 받아오도록 각 features/<카테고리>/api/ 를 교체한다.
 */
export const MOCK_STORES: Store[] = [
  {
    id: "store-001",
    name: "동네 파스타",
    cuisineType: "양식",
    location: { lat: 37.5665, lng: 126.978 },
    address: "서울시 마포구 ○○로 12",
    thumbnailUrl: "https://picsum.photos/seed/store-001/400/300",
    businessHours: "매일 11:00 - 21:00",
    phone: "02-1234-5678",
    supports: { "partner-stores": true, "oneday-class": true },
    partnerStoreDetail: {
      partnerWith: ["이태원 와인바"],
      items: [
        { id: "menu-001-1", name: "알리오올리오", price: 12000 },
        { id: "menu-001-2", name: "리조또", price: 13000 },
      ],
    },
    onedayClassDetail: {
      classes: [
        {
          id: "class-001-1",
          name: "파스타 만들기 클래스",
          datetime: "2026-10-04T14:00:00",
          capacity: 8,
          fee: 35000,
        },
      ],
    },
  },
  {
    id: "store-002",
    name: "이모네 반찬가게",
    cuisineType: "한식",
    location: { lat: 37.5651, lng: 126.9895 },
    address: "서울시 마포구 ○○길 3",
    thumbnailUrl: "https://picsum.photos/seed/store-002/400/300",
    businessHours: "매일 09:00 - 20:00",
    phone: "02-2222-3333",
    supports: { "closing-sale": true },
    closingSaleDetail: {
      items: [
        {
          id: "sale-002-1",
          name: "잡채",
          originalPrice: 8000,
          discountRate: 0.3,
        },
        {
          id: "sale-002-2",
          name: "오늘의 국",
          originalPrice: 6000,
          discountRate: 0.5,
        },
      ],
    },
  },
  {
    id: "store-003",
    name: "스터디 라운지",
    location: { lat: 37.5601, lng: 126.9822 },
    address: "서울시 마포구 ○○대로 45 3층",
    thumbnailUrl: "https://picsum.photos/seed/store-003/400/300",
    businessHours: "매일 09:00 - 23:00",
    phone: "02-4444-5555",
    supports: { "space-rental": true },
    spaceRentalDetail: {
      spaces: [
        {
          id: "space-003-1",
          name: "2인실",
          pricePerHour: 5000,
          timeSlots: ["10:00-12:00", "14:00-16:00"],
        },
        {
          id: "space-003-2",
          name: "4인실",
          pricePerHour: 9000,
          timeSlots: ["13:00-15:00", "18:00-20:00"],
        },
      ],
    },
  },
  {
    id: "store-004",
    name: "클레이 공방",
    location: { lat: 37.5586, lng: 126.9754 },
    address: "서울시 용산구 ○○길 9",
    thumbnailUrl: "https://picsum.photos/seed/store-004/400/300",
    businessHours: "화-일 10:00 - 19:00 (월요일 휴무)",
    phone: "02-6666-7777",
    supports: { "oneday-class": true },
    onedayClassDetail: {
      classes: [
        {
          id: "class-004-1",
          name: "도자기 원데이 클래스",
          datetime: "2026-10-05T13:00:00",
          capacity: 6,
          fee: 45000,
        },
      ],
    },
  },
  {
    id: "store-005",
    name: "골목 카페",
    cuisineType: "카페 · 디저트",
    location: { lat: 37.5633, lng: 126.9819 },
    address: "서울시 마포구 ○○로 21",
    thumbnailUrl: "https://picsum.photos/seed/store-005/400/300",
    businessHours: "매일 08:00 - 22:00",
    phone: "02-8888-9999",
    supports: { "partner-stores": true, coupon: true },
    partnerStoreDetail: {
      partnerWith: ["옆 골목 서점"],
      items: [
        { id: "menu-005-1", name: "아메리카노", price: 4500 },
        { id: "menu-005-2", name: "카페라떼", price: 5000 },
      ],
    },
    couponDetail: {
      requiredStamps: 10,
      reward: "음료 1잔 무료",
    },
  },
];
