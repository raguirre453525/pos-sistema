import Navbar from "@/components/layout/NavBar";
import SideBar from "@/components/layout/SideBar";






export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SideBar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 overflow-y-auto p-6 py-0 bg-background/50">
          {children}
        </main>
      </div>
    </div>
  );
}
