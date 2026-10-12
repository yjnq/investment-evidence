import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'知序 · 投资事件证据工作台',description:'追溯每项判断，看清每次变化。投资事件证据与版本时间线。'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
