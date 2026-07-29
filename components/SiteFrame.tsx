import Masthead from "./Masthead";
import SiteFooter from "./SiteFooter";
import SiteNav from "./SiteNav";
import Ticker from "./Ticker";

/** Every page except the duel wears this. The duel is deliberately bare. */
export default function SiteFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="wrap">
      <Masthead />
      <SiteNav />
      <Ticker />
      {children}
      <SiteFooter />
    </div>
  );
}
