import type { Dictionary } from "../translate.ts";
import { aiinput } from "./aiinput.ts";
import { atlas } from "./atlas.ts";
import { chatSetup } from "./chatsetup.ts";
import { discover } from "./discover.ts";
import { economics } from "./economics.ts";
import { factory } from "./factory.ts";
import { publicSite } from "./public.ts";
import { schemeFinder } from "./schemefinder.ts";
import { site } from "./site.ts";
import { workspace } from "./workspace.ts";

/** Section dictionaries, each `{ hi, gu }` keyed by the English source string. Add a section by importing it here. */
export const SECTIONS: { hi: Dictionary; gu: Dictionary }[] = [aiinput, publicSite, factory, discover, economics, workspace, atlas, site, chatSetup, schemeFinder];
