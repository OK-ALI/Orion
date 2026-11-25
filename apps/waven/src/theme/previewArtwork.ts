import type { WavenThemeId } from './appearance';

const day = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600">
<defs>
  <linearGradient id="sky" x2="0" y2="1">
    <stop stop-color="#58B8EA"/>
    <stop offset=".65" stop-color="#C7EFFF"/>
    <stop offset="1" stop-color="#F8FCFE"/>
  </linearGradient>
  <linearGradient id="sea" x2="0" y2="1">
    <stop stop-color="#80C8DD"/>
    <stop offset="1" stop-color="#23668E"/>
  </linearGradient>
  <linearGradient id="hill" x2="0" y2="1">
    <stop stop-color="#77ADB6"/>
    <stop offset="1" stop-color="#315E75"/>
  </linearGradient>
</defs>

<path fill="url(#sky)" d="M0 0H960V600H0Z"/>
<circle cx="765" cy="104" r="55" fill="#FFFFF4" opacity=".92"/>

<!-- Layered hand-drawn cloud banks -->
<g fill="#FFFFFF">
  <path opacity=".88" d="M0 115Q49 74 107 93Q120 48 185 60Q216 12 272 47Q320 40 341 86Q395 64 430 108L508 128L0 137Z"/>
  <path opacity=".72" d="M420 48Q474 20 518 44Q554 4 601 43Q655 31 678 70L804 82L525 94Z"/>
  <path opacity=".8" d="M612 176Q657 151 691 164Q717 122 759 150Q786 131 831 165Q894 150 960 181V202L612 192Z"/>
</g>

<path fill="#A9D9E9" d="M0 277L94 197L166 248L288 143L393 242L452 218L560 290H960V350H0Z"/>
<path fill="#DFEFF4" d="M207 222L288 143L354 203L309 191L287 208L269 179Z"/>

<path fill="#7DAEBE" d="M0 305L126 247L233 287L336 251L477 320L569 272L660 327H960V374H0Z"/>
<path fill="url(#sea)" d="M0 340H960V600H0Z"/>

<!-- Sunlit water reflections -->
<g fill="none" stroke="#D9F7FF" stroke-linecap="round">
  <path opacity=".65" stroke-width="3" d="M420 365H573M619 379H830M560 401H670M708 426H935"/>
  <path opacity=".43" stroke-width="2" d="M35 378H175M280 409H400M480 451H710M750 476H918"/>
  <path opacity=".37" d="M80 421H240M320 475H500M584 512H830"/>
</g>

<!-- Coastal headland -->
<path fill="url(#hill)" d="M0 256Q100 248 170 315Q260 296 333 386L427 600H0Z"/>
<path fill="#568A91" d="M0 288Q110 274 196 348L326 432L0 481Z"/>
<path fill="#264C63" d="M0 430L146 387L277 431L397 600H0Z"/>

<!-- Coastal railway perspective -->
<path fill="#C1D0D2" d="M0 497L492 344L559 350L258 600H0Z"/>
<path fill="#465C6A" d="M0 527L510 348L520 349L166 600H0Z"/>
<path fill="none" stroke="#ECF8FB" stroke-width="5" d="M0 520L511 348M164 600L528 349"/>
<g stroke="#718794" stroke-width="5">
  <path d="M24 536L196 553M100 509L235 516M190 476L296 484M267 450L344 455M336 425L393 430M394 402L436 405"/>
</g>

<!-- Distant railway carriage -->
<path fill="#EAF5F6" stroke="#315A74" stroke-width="2" d="M380 381L380 350L485 330L530 342L529 365L425 392Z"/>
<path fill="#367EAD" d="M385 356L480 338L480 355L385 377Z"/>
<path fill="#8DC6DA" d="M489 339L521 347V357L489 352Z"/>

<g stroke="#F0FAFC" stroke-width="2">
  <path d="M403 352V373M425 348V368M447 343V363M468 340V359"/>
</g>

<!-- Foreground utility lines and grass -->
<g stroke="#38576C" fill="none">
  <path stroke-width="7" d="M88 165V493"/>
  <path stroke-width="4" d="M51 181H125M110 183L522 308M57 182L517 314"/>
  <path stroke-width="3" d="M249 258V430M230 270H268"/>
</g>

<g fill="#183F57">
  <path d="M0 600V537L31 551L39 519L64 561L86 532L110 579L147 543L172 600Z"/>
</g>

<g fill="none" stroke="#F5FCFF" stroke-width="2" stroke-linecap="round">
  <path d="M520 116Q529 104 540 116Q548 104 560 109"/>
  <path d="M577 132Q583 124 590 132Q598 124 607 128"/>
</g>
</svg>`;

const night = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 600">
<defs>
  <linearGradient id="sky" x2="0" y2="1">
    <stop stop-color="#071125"/>
    <stop offset=".62" stop-color="#234D79"/>
    <stop offset="1" stop-color="#478CA6"/>
  </linearGradient>
  <linearGradient id="road" x2="0" y2="1">
    <stop stop-color="#29475F"/>
    <stop offset="1" stop-color="#09172C"/>
  </linearGradient>
  <radialGradient id="moon">
    <stop stop-color="#E3F9FF" stop-opacity=".45"/>
    <stop offset="1" stop-color="#A8E3FF" stop-opacity="0"/>
  </radialGradient>
  <pattern id="windows" width="28" height="34" patternUnits="userSpaceOnUse">
    <path fill="#476B89" d="M5 6H21V24H5Z"/>
    <path fill="#A0E7F4" opacity=".7" d="M8 9H18V21H8Z"/>
  </pattern>
  <linearGradient id="building" x2="1" y2="1">
    <stop stop-color="#172D49"/>
    <stop offset="1" stop-color="#081326"/>
  </linearGradient>
</defs>

<path fill="url(#sky)" d="M0 0H960V600H0Z"/>
<circle cx="690" cy="124" r="120" fill="url(#moon)"/>
<circle cx="690" cy="124" r="43" fill="#D7F3FF"/>

<g fill="#CCEDFF" opacity=".85">
  <circle cx="340" cy="39" r="1.7"/>
  <circle cx="459" cy="78" r="2"/>
  <circle cx="528" cy="31" r="1.4"/>
  <circle cx="602" cy="66" r="1.8"/>
  <circle cx="808" cy="48" r="2"/>
  <circle cx="871" cy="115" r="1.4"/>
  <circle cx="397" cy="146" r="1.3"/>
</g>

<!-- Distant high-rise layers -->
<g fill="#254765">
  <path d="M280 353V179H338V353Z"/>
  <path d="M342 355V214H389V355Z"/>
  <path d="M407 353V132H448V353Z"/>
  <path d="M455 353V232H489V353Z"/>
  <path d="M510 353V182H565V353Z"/>
  <path d="M584 353V218H615V353Z"/>
  <path d="M626 353V160H675V353Z"/>
  <path d="M695 353V208H751V353Z"/>
</g>

<g stroke="#6BB9D5" opacity=".5" stroke-width="2">
  <path d="M422 120V78M436 131V99M647 155V112"/>
</g>

<!-- Deep architectural perspective -->
<path fill="url(#building)" d="M0 26L242 112V452L0 599Z"/>
<path fill="#183450" d="M242 112L313 146V409L242 452Z"/>
<path fill="url(#windows)" d="M20 83L222 146V422L20 526Z" opacity=".64"/>

<path fill="#122842" d="M316 203L390 232V376L316 422Z"/>
<path fill="url(#windows)" d="M326 234L379 252V367L326 401Z" opacity=".43"/>

<path fill="#142A43" d="M960 24L753 113V433L960 599Z"/>
<path fill="#0A192F" d="M753 113L688 156V401L753 433Z"/>
<path fill="url(#windows)" d="M778 143L935 84V524L778 412Z" opacity=".8"/>

<path fill="#152F4B" d="M683 191L622 223V371L683 413Z"/>
<path fill="url(#windows)" d="M671 222L634 241V363L671 394Z" opacity=".4"/>

<!-- Street and converging sidewalks -->
<path fill="url(#road)" d="M443 340H557L960 600H0Z"/>
<path fill="#213C53" d="M0 600L438 340L407 340L0 510Z"/>
<path fill="#24435A" d="M557 340H583L960 509V600Z"/>

<g fill="none" stroke="#6198AE" stroke-width="2">
  <path d="M0 599L443 340M960 599L557 340"/>
  <path d="M100 540L188 557M210 480L279 493M785 488L850 475"/>
</g>

<!-- Wet pavement reflections -->
<g stroke-linecap="round">
  <path stroke="#73D5F0" stroke-width="5" opacity=".35" d="M182 558L361 437M793 561L637 448"/>
  <path stroke="#A8E8F7" stroke-width="3" opacity=".44" d="M300 574L425 418M654 568L579 423"/>
  <path stroke="#2378BB" stroke-width="9" opacity=".28" d="M386 600L469 421M756 600L610 439"/>
</g>

<!-- Lit shop fronts and original abstract signage -->
<path fill="#69D9EC" d="M28 401L220 350V363L28 417Z"/>
<path fill="#2D88C5" d="M784 342L933 395V413L784 355Z"/>
<path fill="#B8EEF3" d="M54 438L115 415V470L54 507Z" opacity=".7"/>
<path fill="#80C9E0" d="M136 409L211 386V430L136 459Z" opacity=".6"/>
<path fill="#87D9F0" d="M795 383L855 407V462L795 428Z" opacity=".8"/>

<!-- Street lamps -->
<g fill="none" stroke="#14293F" stroke-width="6">
  <path d="M235 507V279Q235 265 249 265H279"/>
  <path d="M731 493V268Q731 255 718 255H686"/>
</g>

<g fill="#D7F9FF">
  <path d="M265 260H289V267H265Z"/>
  <path d="M676 250H698V257H676Z"/>
</g>

<!-- Foreground balcony and framing -->
<path fill="#071326" d="M0 0H960V17L0 40Z"/>
<path fill="#071326" d="M0 577L960 568V600H0Z"/>

<g stroke="#7DB8D1" stroke-width="2" opacity=".5">
  <path d="M0 572L960 563M90 575V600M310 573V600M700 570V600"/>
</g>
</svg>`;

export function getPreviewArtwork(theme: WavenThemeId): string | null {
  if (theme === 'noir') return null;

  const svg = theme === 'hikari' ? day : night;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
