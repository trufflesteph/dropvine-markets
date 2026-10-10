import AlertsDialog from "@/components/alerts-dialog";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";

// Public pages get the site header and footer; /admin sits outside this group and does not.
export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
      <AlertsDialog />
    </>
  );
}
