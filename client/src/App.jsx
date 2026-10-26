import { useEffect, useState } from "react";
import "./App.css";
import { ReportStack } from "./dsa/stack";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

function App() {
  const [recentReports, setRecentReports] = useState([]);
  const [stackMessage, setStackMessage] = useState("");
  const [page, setPage] = useState("login");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [student, setStudent] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [matchingItemId, setMatchingItemId] = useState(null);
  const [matchResults, setMatchResults] = useState({});
  const [matchingError, setMatchingError] = useState("");
  const [claims, setClaims] = useState([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimActionLoading, setClaimActionLoading] = useState(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    studentId: "",
    password: "",
    confirmPassword: "",
  });

  const token = () => localStorage.getItem("campusfind_token");

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: `Bearer ${token()}`,
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || "The request could not be completed.");
    }

    return data;
  }

  useEffect(() => {
    async function restoreSession() {
      const savedToken = token();

      if (!savedToken) return;

      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${savedToken}` },
        });

        const data = await response.json();

        if (!response.ok) {
          localStorage.removeItem("campusfind_token");
          return;
        }

        setStudent(data.student);
        setPage("dashboard");
      } catch {
        setMessage(
          "Unable to connect to CampusFind. Please check your backend."
        );
      }
    }

    restoreSession();
  }, []);

  function updateForm(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setMessage("");
  }

  function changePage(nextPage) {
    setPage(nextPage);
    setMessage("");
    setShowPassword(false);
    setMatchingError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    if (loading) return;

    if (page === "register") {
      if (!form.name.trim() || !form.studentId.trim()) {
        setMessage("Please enter your full name and student ID.");
        return;
      }

      if (form.password.length < 8) {
        setMessage("Password must contain at least 8 characters.");
        return;
      }

      if (form.password !== form.confirmPassword) {
        setMessage("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint =
        page === "register"
          ? "/api/auth/register"
          : "/api/auth/login";

      const payload =
        page === "register"
          ? {
              name: form.name.trim(),
              studentId: form.studentId.trim(),
              email: form.email.trim().toLowerCase(),
              password: form.password,
            }
          : {
              email: form.email.trim().toLowerCase(),
              password: form.password,
            };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message || "Something went wrong.");
        return;
      }

      if (page === "register") {
        setMessage("Account created successfully! Please sign in.");

        setForm((previous) => ({
          ...previous,
          name: "",
          studentId: "",
          password: "",
          confirmPassword: "",
        }));

        setPage("login");
        return;
      }

      if (!data.token || !data.student) {
        setMessage("Login response was incomplete.");
        return;
      }

      localStorage.setItem("campusfind_token", data.token);
      setStudent(data.student);
      setPage("dashboard");
      setMessage("");
    } catch {
      setMessage(
        "Cannot connect to the server. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("campusfind_token");

    setStudent(null);
    setReports([]);
    setClaims([]);
    setMatchResults({});
    setRecentReports([]);
    setForm({
      name: "",
      email: "",
      studentId: "",
      password: "",
      confirmPassword: "",
    });

    setMessage("You have logged out successfully.");
    setPage("login");
  }

  async function handleReportSubmit(event) {
    event.preventDefault();

    setMessage("");

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);

    const report = {
      type: page,
      itemName: String(formData.get("itemName") || "").trim(),
      category: String(formData.get("category") || "").trim(),
      location: String(formData.get("location") || "").trim(),
      description: String(formData.get("description") || "").trim(),
    };

    try {
      const data = await apiRequest("/api/items", {
        method: "POST",
        body: JSON.stringify(report),
      });

      setMessage(data.message || "Report saved successfully!");
      formElement.reset();
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function loadReports(type = "all") {
    setReportsLoading(true);
    setMessage("");

    try {
      const query = type === "all" ? "" : `?type=${type}`;
      const data = await apiRequest(`/api/items${query}`);

      setReports(Array.isArray(data.items) ? data.items : []);
    } catch (error) {
      setMessage(error.message);
      setReports([]);
    } finally {
      setReportsLoading(false);
    }
  }

  async function findMatches(item) {
    if (item.type !== "lost") return;

    setMatchingItemId(item._id);
    setMatchingError("");

    setMatchResults((previous) => ({
      ...previous,
      [item._id]: undefined,
    }));

    try {
      const data = await apiRequest(
        `/api/items/${item._id}/matches`
      );

      setMatchResults((previous) => ({
        ...previous,
        [item._id]: Array.isArray(data.matches)
          ? data.matches
          : [],
      }));
    } catch (error) {
      setMatchingError(error.message);
    } finally {
      setMatchingItemId(null);
    }
  }

  function viewReport(item) {
    const stack = new ReportStack();

    recentReports
      .slice()
      .reverse()
      .forEach((report) => stack.push(report));

    stack.push(item);

    setRecentReports(stack.getAll().slice(0, 5));
    setStackMessage(`Viewed: ${item.itemName}`);
  }

  function removeLatestViewed() {
    if (recentReports.length === 0) {
      setStackMessage("Recently viewed  is empty.");
      return;
    }

    const stack = new ReportStack();

    recentReports
      .slice()
      .reverse()
      .forEach((report) => stack.push(report));

    const removedReport = stack.pop();

    setRecentReports(stack.getAll());

    setStackMessage(
      removedReport
        ? `Removed latest viewed report: ${removedReport.itemName}`
        : "Stack is empty."
    );
  }

  // -------------------- CLAIM FUNCTIONS --------------------

  async function createClaim(lostItem, foundItem) {
    const confirmed = window.confirm(
      `Do you want to claim "${foundItem.itemName}" as your lost item?`
    );

    if (!confirmed) return;

    setClaimActionLoading(foundItem._id);
    setMessage("");

    try {
      const data = await apiRequest(
        `/api/items/${lostItem._id}/claim`,
        {
          method: "POST",
          body: JSON.stringify({
            foundItemId: foundItem._id,
          }),
        }
      );

      setMessage(data.message);
      await loadClaims();
      await loadReports("all");
      await findMatches(lostItem);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setClaimActionLoading(null);
    }
  }

  async function loadClaims() {
    setClaimsLoading(true);

    try {
      const data = await apiRequest("/api/claims");
      setClaims(Array.isArray(data.claims) ? data.claims : []);
    } catch (error) {
      setMessage(error.message);
      setClaims([]);
    } finally {
      setClaimsLoading(false);
    }
  }

  async function performClaimAction(claimId, action) {
    const actionMessages = {
      accept: "Accept this claim?",
      reject: "Reject this claim?",
      "confirm-owner":
        "Confirm that you received the item from the finder?",
      "confirm-finder":
        "Confirm that you handed over the item to the owner?",
    };

    const confirmed = window.confirm(
      actionMessages[action] || "Continue with this action?"
    );

    if (!confirmed) return;

    setClaimActionLoading(claimId);
    setMessage("");

    try {
      const data = await apiRequest(
        `/api/claims/${claimId}/${action}`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      setMessage(data.message);

      await loadClaims();
      await loadReports("all");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setClaimActionLoading(null);
    }
  }

  useEffect(() => {
    if (page === "explore" && student) {
      loadReports("all");
    }

    if (page === "myclaims" && student) {
      loadClaims();
    }

    // Data loads when the selected page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, student]);

  // -------------------- SHARED NAVBAR --------------------

  function Navbar({ dashboard = false }) {
    return (
      <header className="auth-navbar">
        <div className="auth-brand">
          <span className="auth-brand-icon">⌕</span>
          <span className="auth-brand-text">
            campus<span>find</span>
            <small>LOST &amp; FOUND</small>
          </span>
        </div>

        <div className="dashboard-actions">
          {dashboard && (
            <button
              type="button"
              className="auth-nav-button"
              onClick={() => changePage("myclaims")}
            >
              My Claims
            </button>
          )}

          <button
            type="button"
            className="auth-nav-button"
            onClick={() =>
              changePage(dashboard ? "explore" : "dashboard")
            }
          >
            {dashboard ? "Explore Reports" : "Dashboard"}
          </button>

          <button
            type="button"
            className="auth-nav-button"
            onClick={handleLogout}
          >
            Logout ↗
          </button>
        </div>
      </header>
    );
  }

  // -------------------- DASHBOARD --------------------

  if (page === "dashboard" && student) {
    return (
      <div className="auth-page">
        <Navbar dashboard />

        <main className="auth-form-side">
          <section className="auth-card">
            <div className="auth-card-symbol">✳</div>
            <span className="auth-eyebrow">STUDENT DASHBOARD</span>

            <h2>Welcome, {student.name}!</h2>

            <p className="auth-subtitle">
              Welcome to your CampusFind student space.
            </p>

            <div className="auth-message">
              <strong>Student details</strong>
              <p>Name: {student.name}</p>
              <p>Student ID: {student.studentId}</p>
              <p>Email: {student.email}</p>
            </div>

            <h3>What would you like to do?</h3>

            <div className="dashboard-actions">
              <button
                type="button"
                className="dashboard-action"
                onClick={() => changePage("lost")}
              >
                <span className="story-point-icon">⌕</span>
                <span>
                  <strong>Report a lost item</strong>
                  <small>Report an item you have misplaced.</small>
                </span>
              </button>

              <button
                type="button"
                className="dashboard-action"
                onClick={() => changePage("found")}
              >
                <span className="story-point-icon">✓</span>
                <span>
                  <strong>Report a found item</strong>
                  <small>Help another student find their belongings.</small>
                </span>
              </button>

              <button
                type="button"
                className="dashboard-action"
                onClick={() => changePage("explore")}
              >
                <span className="story-point-icon">↔</span>
                <span>
                  <strong>Explore reports</strong>
                  <small>View active lost and found reports.</small>
                </span>
              </button>

              <button
                type="button"
                className="dashboard-action"
                onClick={() => changePage("myclaims")}
              >
                <span className="story-point-icon">✓</span>
                <span>
                  <strong>My Claims</strong>
                  <small>
                    Accept claims and confirm item handovers.
                  </small>
                </span>
              </button>
            </div>

            <p className="auth-privacy">
              CampusFind is a student-to-student lost and found platform.
            </p>
          </section>
        </main>

        <footer className="auth-bottom">
          <span>© 2026 CampusFind</span>
          <span>Lost less. Help more.</span>
        </footer>
      </div>
    );
  }

  // -------------------- CREATE LOST / FOUND REPORT --------------------

  if (student && (page === "lost" || page === "found")) {
    const title =
      page === "lost"
        ? "Report a Lost Item"
        : "Report a Found Item";

    const description =
      page === "lost"
        ? "Tell other students about the item you lost."
        : "Help another student find their belongings.";

    return (
      <div className="auth-page">
        <Navbar />

        <main className="auth-form-side">
          <section className="auth-card">
            <div className="auth-card-symbol">✳</div>
            <span className="auth-eyebrow">CAMPUSFIND</span>

            <h2>{title}</h2>
            <p className="auth-subtitle">{description}</p>

            <form onSubmit={handleReportSubmit}>
              <label htmlFor="itemName">Item name</label>
              <input
                id="itemName"
                name="itemName"
                type="text"
                placeholder="Example: Blue water bottle"
                required
              />

              <label htmlFor="category">Category</label>
              <select
                id="category"
                name="category"
                required
                defaultValue=""
              >
                <option value="" disabled>
                  Select a category
                </option>
                <option value="Electronics">Electronics</option>
                <option value="Books and stationery">
                  Books and stationery
                </option>
                <option value="Clothing and accessories">
                  Clothing and accessories
                </option>
                <option value="ID card or wallet">
                  ID card or wallet
                </option>
                <option value="Other">Other</option>
              </select>

              <label htmlFor="location">Location</label>
              <input
                id="location"
                name="location"
                type="text"
                placeholder="Where was it lost or found?"
                required
              />

              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                placeholder="Describe the item and identifying details"
                rows="4"
                required
              />

              {message && (
                <div className="auth-message" role="status">
                  {message}
                </div>
              )}

              <button type="submit" className="auth-submit">
                Submit Report →
              </button>
            </form>
          </section>
        </main>

        <footer className="auth-bottom">
          <span>© 2026 CampusFind</span>
          <span>Lost less. Help more.</span>
        </footer>
      </div>
    );
  }

  // -------------------- MY CLAIMS PAGE --------------------

  if (student && page === "myclaims") {
    return (
      <div className="auth-page">
        <Navbar />

        <main className="auth-form-side">
          <section className="auth-card">
            <div className="auth-card-symbol">✓</div>
            <span className="auth-eyebrow">CLAIM MANAGEMENT</span>

            <h2>My Claims</h2>

            <p className="auth-subtitle">
              Accept claims and confirm the item handover.
            </p>

            {message && (
              <div className="auth-message" role="status">
                {message}
              </div>
            )}

            <button
              type="button"
              className="auth-submit"
              onClick={loadClaims}
              disabled={claimsLoading}
            >
              {claimsLoading ? "Loading claims..." : "Refresh Claims ↻"}
            </button>

            {claimsLoading ? (
              <p>Loading claims...</p>
            ) : claims.length === 0 ? (
              <div className="auth-message">
                You do not have any claims yet.
              </div>
            ) : (
              <div className="report-list">
                {claims.map((claim) => {
                  const isClaimant =
                    String(claim.claimant) === String(student.id) ||
                    String(claim.lostItem?.owner?._id) ===
                      String(student.id);

                  const isFinder =
                    String(claim.finder) === String(student.id) ||
                    String(claim.foundItem?.owner?._id) ===
                      String(student.id);

                  const busy = claimActionLoading === claim._id;

                  return (
                    <article className="auth-message" key={claim._id}>
                      <h3>
                        {claim.lostItem?.itemName || "Lost item"} ↔{" "}
                        {claim.foundItem?.itemName || "Found item"}
                      </h3>

                      <p>
                        <strong>Claim status:</strong>{" "}
                        {claim.status}
                      </p>

                      <p>
                        Finder accepted:{" "}
                        {claim.finderAccepted ? "Yes" : "No"}
                      </p>

                      <p>
                        Owner confirmed receipt:{" "}
                        {claim.ownerConfirmed ? "Yes" : "No"}
                      </p>

                      <p>
                        Finder confirmed handover:{" "}
                        {claim.finderConfirmed ? "Yes" : "No"}
                      </p>

                      {claim.status === "closed" && (
                        <p>
                          <strong>✓ Both reports are closed.</strong>
                        </p>
                      )}

                      {claim.status === "pending" && isFinder && (
                        <>
                          <button
                            type="button"
                            className="auth-submit"
                            disabled={busy}
                            onClick={() =>
                              performClaimAction(claim._id, "accept")
                            }
                          >
                            {busy ? "Please wait..." : "Accept Claim"}
                          </button>

                          <button
                            type="button"
                            className="auth-nav-button"
                            disabled={busy}
                            onClick={() =>
                              performClaimAction(claim._id, "reject")
                            }
                          >
                            Reject Claim
                          </button>
                        </>
                      )}

                      {claim.status === "accepted" &&
                        isClaimant &&
                        !claim.ownerConfirmed && (
                          <button
                            type="button"
                            className="auth-submit"
                            disabled={busy}
                            onClick={() =>
                              performClaimAction(
                                claim._id,
                                "confirm-owner"
                              )
                            }
                          >
                            Confirm Item Received
                          </button>
                        )}

                      {claim.status === "accepted" &&
                        isFinder &&
                        !claim.finderConfirmed && (
                          <button
                            type="button"
                            className="auth-submit"
                            disabled={busy}
                            onClick={() =>
                              performClaimAction(
                                claim._id,
                                "confirm-finder"
                              )
                            }
                          >
                            Confirm Item Handover
                          </button>
                        )}
                    </article>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              className="auth-nav-button"
              onClick={() => changePage("dashboard")}
            >
              Back to Dashboard
            </button>
          </section>
        </main>

        <footer className="auth-bottom">
          <span>© 2026 CampusFind</span>
          <span>Lost less. Help more.</span>
        </footer>
      </div>
    );
  }

  // -------------------- EXPLORE REPORTS --------------------

  if (student && page === "explore") {
    return (
      <div className="auth-page">
        <Navbar />

        <main className="auth-form-side">
          <section className="auth-card">
            <div className="auth-card-symbol">⌕</div>
            <span className="auth-eyebrow">CAMPUSFIND</span>

            <h2>Explore Campus Reports</h2>

            <p className="auth-subtitle">
              Browse active lost and found reports shared by students.
            </p>

            {message && (
              <div className="auth-message" role="status">
                {message}
              </div>
            )}

            <button
              type="button"
              className="auth-submit"
              onClick={() => loadReports("all")}
              disabled={reportsLoading}
            >
              {reportsLoading ? "Loading reports..." : "Refresh Reports ↻"}
            </button>

            {reportsLoading ? (
              <p>Loading reports...</p>
            ) : reports.length === 0 ? (
              <div className="auth-message">
                No active reports found yet.
              </div>
            ) : (
              <div className="report-list">
                {reports.map((item) => (
                  <article className="auth-message" key={item._id}>
                    <h3>{item.itemName}</h3>

                    <p>
                      Type: {item.type === "lost" ? "Lost" : "Found"}
                    </p>

                    <p>Category: {item.category}</p>
                    <p>Location: {item.location}</p>
                    <p>Description: {item.description}</p>

                    <p>
                      Reported by:{" "}
                      {item.owner?.name || "CampusFind student"}
                    </p>

                    <button
                      type="button"
                      className="auth-submit"
                      onClick={() => viewReport(item)}
                    >
                      View Report
                    </button>

                    {item.type === "lost" && (
                      <div className="matching-section">
                        <button
                          type="button"
                          className="auth-submit"
                          onClick={() => findMatches(item)}
                          disabled={matchingItemId === item._id}
                        >
                          {matchingItemId === item._id
                            ? "Finding matches..."
                            : "Find Matches 🔍"}
                        </button>

                        {matchingError && (
                          <p role="alert">{matchingError}</p>
                        )}

                        {Object.prototype.hasOwnProperty.call(
                          matchResults,
                          item._id
                        ) &&
                          matchResults[item._id] !== undefined && (
                            <div className="matching-results">
                              <h4>Possible Found Matches</h4>

                              {matchResults[item._id].length === 0 ? (
                                <p>No possible matches found.</p>
                              ) : (
                                matchResults[item._id].map((match) => {
                                  const foundItem = match.item;

                                  const ownReport =
                                    String(item.owner?._id) ===
                                    String(student.id);

                                  const alreadyClaimed =
                                    Boolean(item.claimId) ||
                                    Boolean(foundItem.claimId);

                                  return (
                                    <div
                                      className="auth-message"
                                      key={foundItem._id}
                                    >
                                      <h4>{foundItem.itemName}</h4>

                                      <p>
                                        Match score: {match.matchScore}%
                                      </p>

                                      <p>
                                        Category: {foundItem.category}
                                      </p>

                                      <p>
                                        Location: {foundItem.location}
                                      </p>

                                      <p>
                                        Description: {foundItem.description}
                                      </p>

                                      <p>
                                        Found by:{" "}
                                        {foundItem.owner?.name ||
                                          "CampusFind student"}
                                      </p>

                                      <p>
                                        Student ID:{" "}
                                        {foundItem.owner?.studentId ||
                                          "Not available"}
                                      </p>

                                      {foundItem.owner?.email && (
                                        <p>
                                          Finder email:{" "}
                                          {foundItem.owner.email}
                                        </p>
                                      )}

                                      {foundItem.owner?.email && (
                                        <a
                                          className="auth-submit"
                                          href={`mailto:${foundItem.owner.email}?subject=${encodeURIComponent(
                                            `CampusFind - Lost ${item.itemName}`
                                          )}&body=${encodeURIComponent(
                                            `Hi ${
                                              foundItem.owner.name || "there"
                                            },\n\nI saw your found-item report for "${foundItem.itemName}" on CampusFind. I think it may match my lost item "${item.itemName}". Could you please help me verify a few details?\n\nThank you.`
                                          )}`}
                                        >
                                          Contact Finder by Email ✉
                                        </a>
                                      )}

                                      {ownReport && !alreadyClaimed && (
                                        <button
                                          type="button"
                                          className="auth-submit"
                                          disabled={
                                            claimActionLoading ===
                                            foundItem._id
                                          }
                                          onClick={() =>
                                            createClaim(item, foundItem)
                                          }
                                        >
                                          {claimActionLoading ===
                                          foundItem._id
                                            ? "Submitting claim..."
                                            : "Claim This Item"}
                                        </button>
                                      )}

                                      {alreadyClaimed && (
                                        <p>
                                          A claim is already in progress for
                                          one of these reports.
                                        </p>
                                      )}

                                      {match.matchReasons?.length > 0 && (
                                        <p>
                                          Matching reasons:{" "}
                                          {match.matchReasons.join(", ")}
                                        </p>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                      </div>
                    )}

                    <small>
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleString()
                        : ""}
                    </small>
                  </article>
                ))}
              </div>
            )}

            <section className="auth-message">
              <h3>Recently Viewed Reports </h3>

              {stackMessage && <p>{stackMessage}</p>}

              {recentReports.length === 0 ? (
                <p>No recently viewed reports.</p>
              ) : (
                recentReports.map((report) => (
                  <p key={report._id}>
                    {report.itemName} ({report.type})
                  </p>
                ))
              )}

              <button
                type="button"
                className="auth-nav-button"
                onClick={removeLatestViewed}
              >
                Remove Latest Viewed
              </button>
            </section>

            <button
              type="button"
              className="auth-nav-button"
              onClick={() => changePage("dashboard")}
            >
              Back to Dashboard
            </button>
          </section>
        </main>

        <footer className="auth-bottom">
          <span>© 2026 CampusFind</span>
          <span>Lost less. Help more.</span>
        </footer>
      </div>
    );
  }

  // -------------------- LOGIN / REGISTER --------------------

  return (
    <div className="auth-page">
      <header className="auth-navbar">
        <button
          type="button"
          className="auth-brand"
          onClick={() => changePage("login")}
        >
          <span className="auth-brand-icon">⌕</span>
          <span className="auth-brand-text">
            campus<span>find</span>
            <small>LOST &amp; FOUND</small>
          </span>
        </button>

        <div className="auth-nav-right">
          <span>Campus connections start here.</span>

          <button
            type="button"
            className="auth-nav-button"
            onClick={() =>
              changePage(page === "login" ? "register" : "login")
            }
          >
            {page === "login" ? "Create account ↗" : "Back to login"}
          </button>
        </div>
      </header>

      <main className="auth-layout">
        <section className="auth-story">
          <div className="story-badge">
            <span>✳</span> MADE FOR CAMPUS LIFE
          </div>

          <h1>
            Lost something?
            <br />
            <span>Let&apos;s bring it home.</span>
          </h1>

          <p className="story-description">
            A charger, a calculator, or something important. Connect
            with fellow students and help lost belongings find their
            way home.
          </p>

          <div className="story-points">
            <div className="story-point">
              <span className="story-point-icon">⌕</span>
              <div>
                <strong>Find what matters</strong>
                <small>Search campus lost and found reports.</small>
              </div>
            </div>

            <div className="story-point">
              <span className="story-point-icon">↔</span>
              <div>
                <strong>Connect privately</strong>
                <small>Communicate with students through email.</small>
              </div>
            </div>

            <div className="story-point">
              <span className="story-point-icon">✓</span>
              <div>
                <strong>Return with confidence</strong>
                <small>Verify ownership before the handover.</small>
              </div>
            </div>
          </div>

          <div className="story-footer">
            <span className="story-footer-dot" />
            Built for students, by community.
          </div>
        </section>

        <section className="auth-form-side">
          <div className="auth-card">
            <div className="auth-card-symbol">✳</div>

            <span className="auth-eyebrow">
              {page === "login"
                ? "WELCOME BACK"
                : "JOIN THE COMMUNITY"}
            </span>

            <h2>
              {page === "login"
                ? "Good to see you."
                : "Create your account."}
            </h2>

            <p className="auth-subtitle">
              {page === "login"
                ? "Sign in to continue your CampusFind journey."
                : "Join your campus community and reconnect belongings."}
            </p>

            <form onSubmit={handleSubmit}>
              {page === "register" && (
                <>
                  <label htmlFor="name">Full name</label>

                  <input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="Enter your full name"
                    value={form.name}
                    onChange={updateForm}
                    autoComplete="name"
                    required
                  />

                  <label htmlFor="studentId">Student ID</label>

                  <input
                    id="studentId"
                    name="studentId"
                    type="text"
                    placeholder="Enter your student ID"
                    value={form.studentId}
                    onChange={updateForm}
                    required
                  />
                </>
              )}

              <label htmlFor="email">Student email</label>

              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@university.edu"
                value={form.email}
                onChange={updateForm}
                autoComplete="email"
                required
              />

              <label htmlFor="password">Password</label>

              <div className="password-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={updateForm}
                  autoComplete={
                    page === "login"
                      ? "current-password"
                      : "new-password"
                  }
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="show-password"
                  onClick={() =>
                    setShowPassword((previous) => !previous)
                  }
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {page === "register" && (
                <>
                  <label htmlFor="confirmPassword">
                    Confirm password
                  </label>

                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    value={form.confirmPassword}
                    onChange={updateForm}
                    autoComplete="new-password"
                    required
                  />
                </>
              )}

              {message && (
                <div className="auth-message" role="status">
                  {message}
                </div>
              )}

              <button
                type="submit"
                className="auth-submit"
                disabled={loading}
              >
                {loading
                  ? "Please wait..."
                  : page === "login"
                    ? "Sign in to CampusFind →"
                    : "Create account →"}
              </button>
            </form>

            <div className="auth-divider">
              <span>STUDENT COMMUNITY</span>
            </div>

            <p className="auth-switch">
              {page === "login"
                ? "New to CampusFind?"
                : "Already have an account?"}{" "}
              <button
                type="button"
                onClick={() =>
                  changePage(page === "login" ? "register" : "login")
                }
              >
                {page === "login"
                  ? "Create an account"
                  : "Sign in"}
              </button>
            </p>

            <p className="auth-privacy">
              Your personal details should stay private and secure.
            </p>
          </div>
        </section>
      </main>

      <footer className="auth-bottom">
        <span>© 2026 CampusFind</span>
        <span>Lost less. Help more.</span>
      </footer>
    </div>
  );
}

export default App;