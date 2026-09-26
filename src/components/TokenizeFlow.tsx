"use client";
import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowRight,
  ArrowLeft,
  MapPin,
  Check,
  ChevronDown,
  Plus,
} from "lucide-react";
import { formatEther, parseEther } from "viem";
import { ASSET_KINDS, defaultsForKind, type AssetKind } from "@/lib/catalog";
import ProjectPlan from "./ProjectPlan";
import { suggestedProject } from "@/lib/project-plan";
import { spaceDraftError, rightDraftError } from "@/lib/tokenize-validation";
import {
  parseMetadata,
  type Asset,
  type Right,
  type MarketState,
} from "@/lib/model";
export type SpaceForm = {
  name: string;
  district: string;
  kind: string;
  right: string;
  area: string;
  capacity: string;
  supply: string;
  price: string;
  terms: string;
  evidence: string;
  start: string;
  end: string;
  policy: string;
  scope: string;
  purpose: string;
  exclusive: string;
  lng: string;
  lat: string;
  overview: string;
  analysis: string;
};
type Props = {
  form: SpaceForm;
  setForm: Dispatch<SetStateAction<SpaceForm>>;
  state: MarketState;
  active: string;
  actor: string;
  demo: boolean;
  verifierRoles?: { registry: boolean; rights: boolean };
  busy: boolean;
  initialTarget: string;
  createdAsset?: Asset;
  onPick: () => void;
  onActor: (name: string) => void;
  issuerActor: (address: string) => string;
  onRegister: () => Promise<boolean>;
  onIssue: (a: Asset) => Promise<boolean>;
  onAction: (
    label: string,
    contract: "registry" | "rights",
    method: string,
    args: unknown[],
  ) => Promise<boolean>;
  onPublish: (r: Right, amount: string) => Promise<boolean>;
  onCampaign: () => void;
  onActivate: (r: Right) => Promise<boolean>;
  onDeposit: (r: Right, amount: string) => Promise<boolean>;
  onView: (id: string) => void;
};
export default function TokenizeFlow(p: Props) {
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const [target, setTarget] = useState(p.initialTarget),
    [step, setStep] = useState(p.initialTarget === "new" ? 0 : 2),
    [rightChoice, setRightChoice] = useState("latest"),
    [validation, setValidation] = useState(""),
    [offered, setOffered] = useState(""),
    [deposit, setDeposit] = useState("10000");
  useEffect(() => {
    stepHeading.current?.focus({ preventScroll: true });
  }, [step]);
  const { form, setForm, state } = p,
    asset = state.assets.find((a) => a.id === target),
    rights = state.rights.filter((r) => r.assetId === target),
    right =
      rightChoice === "new"
        ? undefined
        : rightChoice === "latest"
          ? rights.at(-1)
          : rights.find((r) => r.id === rightChoice);
  const offeredUnits =
    offered || (right ? state.balances["rights:" + right.id] || "0" : "0");
  let fullSubscription = "—";
  try {
    if (/^\d+$/.test(offeredUnits) && parseEther(form.price) > 0n)
      fullSubscription = Number(
        formatEther(BigInt(offeredUnits) * parseEther(form.price)),
      ).toLocaleString("en-US");
  } catch {}
  useEffect(() => {
    setOffered("");
  }, [right?.id]);
  const owner =
      !!asset && asset.issuer.toLowerCase() === p.active.toLowerCase(),
    canVerify = (contract: "registry" | "rights") =>
      p.demo ? p.actor === "Demo verifier" : !!p.verifierRoles?.[contract];
  const openListings = right
    ? state.listings.filter(
        (l) =>
          l.token === "rights" &&
          l.rightId === right.id &&
          !l.cancelled &&
          BigInt(l.remaining) > 0n,
      )
    : [];
  useEffect(() => {
    if (p.createdAsset) {
      setTarget(p.createdAsset.id);
      setStep(2);
      setRightChoice("new");
    }
  }, [p.createdAsset?.id]);
  const field = (key: keyof SpaceForm, label: string, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        disabled={
          !!asset &&
          ["name", "district", "lng", "lat", "area", "capacity"].includes(key)
        }
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </label>
  );
  const select = (
    key: keyof SpaceForm,
    label: string,
    options: string[],
    change?: (v: string) => void,
  ) => (
    <label>
      {label}
      <select
        aria-label={label}
        disabled={!!asset && key === "kind"}
        value={form[key]}
        onChange={(e) =>
          change
            ? change(e.target.value)
            : setForm({ ...form, [key]: e.target.value })
        }
      >
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
  const next = () => {
    const error = spaceDraftError(form);
    if (error) {
      setValidation(error);
      return;
    }
    setValidation("");
    setStep(1);
  };
  const review = () => {
    const error = rightDraftError(form);
    if (error) {
      setValidation(error);
      return;
    }
    setValidation("");
    setStep(2);
  };
  const choose = (id: string) => {
    setTarget(id);
    setRightChoice("latest");
    setValidation("");
    if (id === "new") {
      setStep(0);
      return;
    }
    const a = state.assets.find((a) => a.id === id);
    if (a) {
      const r = state.rights.filter((r) => r.assetId === id).at(-1),
        l = state.listings.find(
          (l) => l.token === "rights" && l.rightId === r?.id,
        );
      setForm((f) => ({
        ...f,
        ...defaultsForKind(a.kind),
        name: a.name,
        district: a.district,
        lng: String(a.coordinates[0]),
        lat: String(a.coordinates[1]),
        area: String(a.area),
        capacity: String(a.capacity),
        overview: a.description,
        analysis: JSON.stringify(
          parseMetadata(a.metadataURI).projectAssumptions || null,
        ),
        ...(r
          ? {
              right: r.kind,
              supply: r.supply,
              scope: ["Rooftop", "Interior", "Wall", "Land", "Whole asset"][
                r.scope
              ],
              policy: r.policy,
              exclusive: r.exclusive ? "Yes" : "No",
              terms: String(parseMetadata(r.termsURI).purpose || f.terms),
              start: new Date(r.startAt * 1000).toISOString().slice(0, 10),
              end: new Date(r.endAt * 1000).toISOString().slice(0, 10),
            }
          : {}),
        ...(l ? { price: formatEther(BigInt(l.unitPrice)) } : {}),
      }));
    }
    setStep(2);
  };
  const switchOwner = () =>
    p.demo && asset ? (
      <button
        className="primary"
        onClick={() => p.onActor(p.issuerActor(asset.issuer))}
      >
        Switch to {p.issuerActor(asset.issuer)}
      </button>
    ) : (
      <p className="caption">Connect the issuer wallet to continue.</p>
    );
  const verifyButton = (
    label: string,
    contract: "registry" | "rights",
    method: string,
    id: string,
  ) =>
    canVerify(contract) ? (
      <button
        className="primary"
        disabled={p.busy}
        onClick={() => p.onAction(label, contract, method, [id, true])}
      >
        {label}
        <ArrowRight size={16} />
      </button>
    ) : (
      <>
        <p className="caption">A verifier needs to review this request.</p>
        {p.demo && (
          <button
            className="primary"
            onClick={() => p.onActor("Demo verifier")}
          >
            Switch to Demo verifier
          </button>
        )}
      </>
    );
  const operations = right && (
    <>
      {right.status === "Verified" && canVerify("rights") && (
        <button
          className="secondary"
          disabled={p.busy}
          onClick={() => p.onActivate(right)}
        >
          Activate project
        </button>
      )}
      {right.status === "Active" && right.kind === "Revenue Share" && (
        <div className="revenue-operation">
          <label>
            Revenue deposit amount (mJPY)
            <input
              type="number"
              min="1"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
            />
          </label>
          <button
            className="primary"
            disabled={p.busy}
            onClick={() => p.onDeposit(right, deposit)}
          >
            Deposit revenue
          </button>
        </div>
      )}
    </>
  );
  return (
    <section className="tokenize-focus" aria-label="Create and manage a right">
      <div className="wizard-toolbar">
        <label>
          Working on
          <select
            aria-label="Working on"
            value={target}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="new">＋ New space</option>
            {state.assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <span className="caption">One space. One next step.</span>
      </div>
      <ol className="wizard-progress" aria-label="Tokenize steps">
        {["Space", "Right", "Publish"].map((s, i) => (
          <li
            key={s}
            className={step === i ? "current" : step > i ? "complete" : ""}
          >
            <button
              aria-current={step === i ? "step" : undefined}
              onClick={() => {
                setValidation("");
                setStep(i);
              }}
            >
              <span>{step > i ? <Check size={13} /> : i + 1}</span>
              {s}
            </button>
          </li>
        ))}
      </ol>
      <div className="wizard-body">
        {step === 0 && (
          <>
            <span className="eyebrow">01 / YOUR SPACE</span>
            <h2 ref={stepHeading} tabIndex={-1}>
              Where is your space?
            </h2>
            <p className="wizard-description">
              Choose a place and give it a name.
            </p>
            <div className="form-grid">
              {field("name", "Asset name")}
              {select("kind", "Asset type", [...ASSET_KINDS], (v) => {
                const previous = suggestedProject(form.kind as AssetKind, "");
                const named = suggestedProject(
                  form.kind as AssetKind,
                  form.name,
                );
                const untouched =
                  !form.overview ||
                  form.overview === previous.overview ||
                  form.overview === named.overview;
                const next = suggestedProject(v as AssetKind, form.name);
                setForm({
                  ...form,
                  ...defaultsForKind(v as AssetKind),
                  ...(untouched
                    ? {
                        overview: next.overview,
                        analysis: JSON.stringify(next.assumptions),
                      }
                    : {}),
                });
              })}
            </div>
            <div className="location-summary">
              <MapPin size={22} />
              <div>
                <b>{form.district}</b>
                <span>
                  Demo location · {Number(form.lat).toFixed(4)} N,{" "}
                  {Number(form.lng).toFixed(4)} E
                </span>
              </div>
              <button
                className="secondary"
                onClick={p.onPick}
                disabled={!!asset}
              >
                Choose on map
              </button>
            </div>
            <details className="wizard-details">
              <summary>
                Location details <ChevronDown size={15} />
              </summary>
              <div className="form-grid">
                {field("district", "District")}
                {field("area", "Area (m², simulated)", "number")}
                {field("lng", "Longitude", "number")}
                {field("lat", "Latitude", "number")}
                {form.kind === "Rooftop" &&
                  field("capacity", "Capacity (kWp, estimated)", "number")}
              </div>
              <label>
                Evidence / metadata reference
                <textarea
                  value={form.evidence}
                  onChange={(e) =>
                    setForm({ ...form, evidence: e.target.value })
                  }
                />
              </label>
            </details>
            <ProjectPlan
              kind={form.kind as AssetKind}
              name={form.name}
              overview={form.overview}
              analysis={form.analysis}
              disabled={!!asset}
              onChange={(overview, analysis) =>
                setForm((f) => ({ ...f, overview, analysis }))
              }
            />
            <div className="wizard-actions">
              <span>Demo assets only</span>
              <button className="primary" onClick={next}>
                Continue to rights <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <span className="eyebrow">02 / THE OFFER</span>
            <h2 ref={stepHeading} tabIndex={-1}>
              What can people use?
            </h2>
            <p className="wizard-description">
              {form.kind === "Rooftop"
                ? "Offer roof access or a share of actual project revenue."
                : "Offer permission to use this space for a fixed period."}
            </p>
            <div className="form-grid">
              {select(
                "right",
                "Right type",
                ["Usage Right", "Revenue Share", "Lease", "Other"],
                (v) =>
                  setForm({
                    ...form,
                    right: v,
                    supply: v === "Revenue Share" ? "100" : "1",
                    exclusive: v === "Revenue Share" ? "No" : "Yes",
                  }),
              )}
              {field("price", "Primary price (mJPY)", "number")}
              {field("start", "Start date", "date")}
              {field("end", "End date", "date")}
              {form.right === "Revenue Share" &&
                field("supply", "Right supply", "number")}
            </div>
            <div className="offer-note">
              {form.right === "Revenue Share"
                ? `${form.supply} shares · earnings only from actual deposits`
                : "1 usage right · one holder for the selected period"}
            </div>
            <details className="wizard-details">
              <summary>
                Terms & advanced settings <ChevronDown size={15} />
              </summary>
              <div className="form-grid">
                {select("scope", "Spatial scope", [
                  "Rooftop",
                  "Interior",
                  "Wall",
                  "Land",
                  "Whole asset",
                ])}
                {field("purpose", "Purpose (canonical label)")}
                {form.right !== "Revenue Share" &&
                  select("exclusive", "Exclusive usage", ["Yes", "No"])}
                {select("policy", "Transfer policy", [
                  "Open",
                  "Allowlist",
                  "Nontransferable",
                ])}
              </div>
              <label>
                Terms: use, duration, revenue, repairs
                <textarea
                  value={form.terms}
                  onChange={(e) => setForm({ ...form, terms: e.target.value })}
                />
              </label>
            </details>
            <div className="wizard-actions">
              <button className="text-button" onClick={() => setStep(0)}>
                <ArrowLeft size={14} />
                Back
              </button>
              <button className="primary" onClick={review}>
                Review & publish <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <span className="eyebrow">03 / NEXT ACTION</span>
            <h2 ref={stepHeading} tabIndex={-1}>
              {asset ? asset.name : "Ready to start?"}
            </h2>
            {!asset ? (
              <>
                <p className="wizard-description">
                  Register this space first. Verification comes before listing.
                </p>
                <div className="offer-review">
                  <strong>{form.name || "Unnamed space"}</strong>
                  <span>
                    {form.kind} · {form.right}
                  </span>
                  <span>
                    {form.start} → {form.end}
                  </span>
                  <b>
                    {Number(form.price).toLocaleString()} mJPY{" "}
                    {form.right === "Revenue Share" ? "/ share" : "/ period"}
                  </b>
                </div>
                <details className="wizard-details">
                  <summary>
                    Review terms <ChevronDown size={15} />
                  </summary>
                  <p>{form.terms}</p>
                  <p>
                    Transfer: {form.policy} · Scope: {form.scope}
                  </p>
                </details>
                <div className="wizard-actions">
                  <button className="text-button" onClick={() => setStep(1)}>
                    Back
                  </button>
                  <button
                    className="primary"
                    disabled={p.busy || !form.name.trim()}
                    onClick={p.onRegister}
                  >
                    Register demo asset <ArrowRight size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div className="workflow-card">
                <div className="section-row">
                  <span>{asset.kind}</span>
                  <span className="badge">{asset.status}</span>
                </div>
                {asset.status === "Draft" && (
                  <>
                    <h3>Send this space for review.</h3>
                    <p className="caption">
                      The verifier checks your asset before you can issue a
                      right.
                    </p>
                    {owner ? (
                      <button
                        className="primary"
                        disabled={p.busy}
                        onClick={() =>
                          p.onAction(
                            "Submit for verification",
                            "registry",
                            "requestVerification",
                            [asset.id],
                          )
                        }
                      >
                        Submit for verification <ArrowRight size={16} />
                      </button>
                    ) : (
                      switchOwner()
                    )}
                  </>
                )}
                {asset.status === "Pending verification" && (
                  <>
                    <h3>Asset review</h3>
                    {verifyButton(
                      "Demo verify asset",
                      "registry",
                      "verifyAsset",
                      asset.id,
                    )}
                  </>
                )}
                {asset.status === "Rejected" && (
                  <p>
                    Asset review was rejected. Revise the evidence before
                    resubmitting.
                  </p>
                )}
                {asset.status === "Verified" && (
                  <>
                    {rights.length > 0 && (
                      <label className="right-picker">
                        Right
                        <select
                          aria-label="Manage right"
                          value={rightChoice}
                          onChange={(e) => {
                            setRightChoice(e.target.value);
                            if (e.target.value === "new") setStep(1);
                          }}
                        >
                          <option value="latest">Most recent right</option>
                          {rights.map((r) => (
                            <option value={r.id} key={r.id}>
                              {r.kind} #{r.id} · {r.status}
                            </option>
                          ))}
                          <option value="new">＋ Create another right</option>
                        </select>
                      </label>
                    )}
                    {!right && (
                      <>
                        <h3>Issue your {form.right.toLowerCase()}.</h3>
                        <p className="caption">
                          {form.supply}{" "}
                          {form.right === "Revenue Share" ? "shares" : "right"}{" "}
                          · {form.start} → {form.end}
                        </p>
                        <details className="wizard-details">
                          <summary>
                            Review terms <ChevronDown size={15} />
                          </summary>
                          <p>{form.terms}</p>
                        </details>
                        {owner ? (
                          <button
                            className="primary"
                            disabled={p.busy}
                            onClick={async () => {
                              if (await p.onIssue(asset))
                                setRightChoice("latest");
                            }}
                          >
                            Issue right <ArrowRight size={16} />
                          </button>
                        ) : (
                          switchOwner()
                        )}
                      </>
                    )}
                    {right && (
                      <>
                        <div className="right-summary">
                          <b>
                            {right.kind} #{right.id}
                          </b>
                          <span>
                            {right.status} · {right.supply} units
                          </span>
                        </div>
                        {right.status === "Pending verification" &&
                          verifyButton(
                            "Demo verify right",
                            "rights",
                            "verifyRight",
                            right.id,
                          )}
                        {["Verified", "Active"].includes(right.status) && (
                          <>
                            {openListings.length > 0 ? (
                              <>
                                <h3>
                                  {right.kind === "Revenue Share"
                                    ? "Your campaign is live."
                                    : "Your right is on the market."}
                                </h3>
                                {right.kind === "Revenue Share" && (
                                  <button
                                    className="primary"
                                    onClick={p.onCampaign}
                                  >
                                    View campaign <ArrowRight size={16} />
                                  </button>
                                )}
                                <button
                                  className="primary"
                                  onClick={() => p.onView(asset.id)}
                                >
                                  View listing <ArrowRight size={16} />
                                </button>
                              </>
                            ) : (
                              <>
                                {owner ? (
                                  <>
                                    <p className="caption">
                                      Offer verified rights at a fixed price.
                                      Buyers receive tokens and pay you
                                      directly.
                                    </p>
                                    {field(
                                      "price",
                                      "Listing price (mJPY)",
                                      "number",
                                    )}
                                    {right.kind === "Revenue Share" && (
                                      <>
                                        <label>
                                          Units to offer
                                          <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            value={offeredUnits}
                                            onChange={(e) =>
                                              setOffered(e.target.value)
                                            }
                                          />
                                        </label>
                                        <div className="offer-note">
                                          Full-subscription target:{" "}
                                          {fullSubscription} mJPY
                                        </div>
                                        <p className="caption">
                                          Target = offered units × unit price.
                                          No escrow or automatic refund if the
                                          target is missed. Activation is a
                                          separate verified action.
                                        </p>
                                      </>
                                    )}
                                    <button
                                      className="primary"
                                      disabled={p.busy}
                                      onClick={() =>
                                        p.onPublish(right, offeredUnits)
                                      }
                                    >
                                      {right.kind === "Revenue Share"
                                        ? "Launch crowdfunding"
                                        : "Publish listing"}{" "}
                                      <ArrowRight size={16} />
                                    </button>
                                  </>
                                ) : (
                                  switchOwner()
                                )}
                              </>
                            )}
                            {p.actor === "Demo verifier" ? (
                              <div className="operator-actions">
                                {operations}
                              </div>
                            ) : (
                              <details className="wizard-details">
                                <summary>
                                  Project operations <ChevronDown size={15} />
                                </summary>
                                {operations}
                              </details>
                            )}
                          </>
                        )}
                        {owner && (
                          <button
                            className="text-button add-right"
                            onClick={() => {
                              setRightChoice("new");
                              setStep(1);
                            }}
                          >
                            <Plus size={13} />
                            Create another right
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
        {validation && (
          <p className="wizard-validation" role="alert">
            {validation}
          </p>
        )}
      </div>
    </section>
  );
}
