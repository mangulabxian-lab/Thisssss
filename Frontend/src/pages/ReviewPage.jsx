// src/pages/ReviewPage.jsx
import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import "./ReviewPage.css";

const ReviewPage = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("toReview"); // "toReview" | "reviewed"
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("all");
  const [items, setItems] = useState([]);

  const toReviewCount = useMemo(
    () => items.filter((i) => !i.reviewed).length,
    [items]
  );

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // 1) Get all classes where user is teacher
        const classesRes = await api.get("/class/my-classes");
        const classesData = classesRes.data.data || classesRes.data || [];
        const teachingClasses = classesData.filter(
          (c) => c.userRole === "teacher" || c.isTeacher
        );
        setClasses(teachingClasses);

        const allItems = [];

        // 2) For each teaching class, get classwork + students
        for (const cls of teachingClasses) {
          try {
            const [classworkRes, peopleRes] = await Promise.all([
              api.get(`/classwork/${cls._id}`),
              api.get(`/student-management/${cls._id}/students`),
            ]);

            const classworkData =
              classworkRes.data?.data || classworkRes.data || [];
            const students =
              peopleRes.data?.data?.students ||
              peopleRes.data?.students ||
              [];

            const assignedCount = students.length;

            // 3) Convert each classwork/quiz to a "review item"
            classworkData.forEach((item) => {
              const isQuizOrExam =
                item.type === "quiz" || item.type === "exam";

              // You can also show assignments/projects; for now we show both
              if (
                !["quiz", "exam", "assignment", "project"].includes(item.type)
              ) {
                return;
              }

              const completedBy = item.completedBy || [];
              const turnedIn = completedBy.length;

              // If we don't have real "graded" info, treat all turned-in as graded
              const graded =
                completedBy.filter(
                  (s) =>
                    s.score !== undefined &&
                    s.score !== null &&
                    (s.maxScore || s.percentage !== undefined)
                ).length || turnedIn;

              allItems.push({
                _id: item._id,
                classId: cls._id,
                className: cls.name,
                section: cls.section || cls.code || "",
                title: item.title || "Untitled",
                typeLabel: isQuizOrExam ? "Exam" : "Assignment",
                postedAt: item.createdAt ? new Date(item.createdAt) : null,
                turnedIn,
                assigned: assignedCount,
                graded,
                reviewed: false, // front-end only flag
              });
            });
          } catch (err) {
            console.error("Failed to load classwork for class", cls._id, err);
          }
        }

        setItems(allItems);
      } catch (err) {
        console.error("Failed to load review page data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleMarkReviewed = (id) => {
    setItems((prev) =>
      prev.map((item) =>
        item._id === id ? { ...item, reviewed: true } : item
      )
    );
  };

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        const matchesTab =
          tab === "toReview" ? !item.reviewed : item.reviewed;
        const matchesClass =
          selectedClassId === "all" || item.classId === selectedClassId;
        return matchesTab && matchesClass;
      }),
    [items, tab, selectedClassId]
  );

  const formatPosted = (date) => {
    if (!date) return "";
    const now = new Date();
    const diffMs = now - date;
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 1) {
      const mins = Math.round(diffHours * 60);
      return `${mins} min${mins !== 1 ? "s" : ""} ago`;
    }
    if (diffHours < 24) {
      const hrs = Math.round(diffHours);
      return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
    }
    const days = Math.round(diffHours / 24);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  };

  return (
    <div className="review-page">
      {/* Top bar with back + title */}
      <header className="review-header">
        <div className="review-header-left">
         <button
  className="review-back-btn"
  onClick={() => navigate("/dashboard")}
>
  <span className="arrow">←</span>
  Back
</button>

          <div className="review-title-block">
            <h1>Items to review</h1>
            <p>Review and grade student submissions</p>
          </div>
        </div>
        <div className="review-header-right">
          <div className="review-items-pill">
            {toReviewCount} item{toReviewCount !== 1 ? "s" : ""}
          </div>
        </div>
      </header>

      {/* Tabs + class filter */}
      <div className="review-tabs-row">
        <div className="review-tabs">
          <button
            className={`review-tab ${
              tab === "toReview" ? "active" : ""
            }`}
            onClick={() => setTab("toReview")}
          >
            To review
          </button>
          <button
            className={`review-tab ${
              tab === "reviewed" ? "active" : ""
            }`}
            onClick={() => setTab("reviewed")}
          >
            Reviewed
          </button>
        </div>

        <div className="review-class-filter">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
          >
            <option value="all">All classes</option>
            {classes.map((cls) => (
              <option key={cls._id} value={cls._id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <main className="review-content">
        {loading ? (
          <div className="review-loading">Loading items…</div>
        ) : filteredItems.length === 0 ? (
          <div className="review-empty">
            <p>No items in this section.</p>
          </div>
        ) : (
          <>
            <h2 className="review-section-title">No due date</h2>

            <div className="review-list">
              {filteredItems.map((item) => (
                <div key={item._id} className="review-item-card">
                  <div className="review-item-main">
                    <div className="review-item-icon">
                      <div className="icon-circle">
                        {item.typeLabel === "Exam" ? "📝" : "📄"}
                      </div>
                    </div>
                    <div className="review-item-text">
                      <div className="review-item-type">
                        {item.typeLabel}
                      </div>
                      <div className="review-item-title">
                        {item.title}
                      </div>
                      <div className="review-item-meta">
                        <span className="meta-class">
                          {item.className}
                        </span>
                        {item.section && (
                          <>
                            <span className="meta-dot">•</span>
                            <span className="meta-section">
                              {item.section}
                            </span>
                          </>
                        )}
                        {item.postedAt && (
                          <>
                            <span className="meta-dot">•</span>
                            <span className="meta-time">
                              Posted {formatPosted(item.postedAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="review-item-right">
                    <div className="review-stats">
                      <div className="review-stat">
                        <span className="stat-number">
                          {item.turnedIn}
                        </span>
                        <span className="stat-label">Turned in</span>
                      </div>
                      <div className="review-stat">
                        <span className="stat-number">
                          {item.assigned}
                        </span>
                        <span className="stat-label">Assigned</span>
                      </div>
                      <div className="review-stat">
                        <span className="stat-number">
                          {item.graded}
                        </span>
                        <span className="stat-label">Graded</span>
                      </div>
                    </div>

                    <div className="review-actions">
                      <button
                        className="review-primary-btn"
                        onClick={() => {
                          // For quizzes/exams, go to teacher exam page
                          if (item.typeLabel === "Exam") {
                            navigate(`/teacher-exam/${item._id}`);
                          } else {
                            // For assignments, just go back to Dashboard
                            navigate("/", {
                              state: {
                                selectedClassId: item.classId,
                                activeTab: "classwork",
                              },
                            });
                          }
                        }}
                      >
                        Review
                      </button>
                      {tab === "toReview" && (
                        <button
                          className="review-secondary-btn"
                          onClick={() => handleMarkReviewed(item._id)}
                        >
                          Mark as reviewed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ReviewPage;
