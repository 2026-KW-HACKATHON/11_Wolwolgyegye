import { useLocation } from 'react-router-dom';

/** 현재 경로. 끝의 슬래시는 제거해서 '/recommend/' 와 '/recommend' 를 같은 것으로 본다. */
export function useActivePath(): string {
  const { pathname } = useLocation();
  return pathname.replace(/\/+$/, '') || '/';
}