import db from "../models/index.js";
import { Op } from "sequelize";

const Issue = db.Issue;
const User = db.User;
const IssueMemberStatus = db.IssueMemberStatus;
const Notification = db.Notification;

/* ======================================================
   HELPER FUNCTIONS
====================================================== */
// Get user ID safely from req.user (supports id, userId, sub)
const getUserId = (reqUser) => {
  return reqUser?.id || reqUser?.userId || reqUser?.sub || null;
};

// Build WHERE clause for issues based on user role (for counting & growth)
const getIssueWhereClause = async (user, timeFilter = null) => {
  if (!user || !user.id) {
    return { issue_id: null };
  }

  if (user.member_type_id === "ADM123456789") {
    const where = {};
    if (timeFilter) where.created_at = { [Op.lte]: timeFilter };
    return where;
  }

  if (user.member_type_id === "member") {
    const where = { user_id: user.id };
    if (timeFilter) where.created_at = { [Op.lte]: timeFilter };
    return where;
  }

  // professional_volunteer or volunteer_member: get issues assigned to them
  const assignments = await IssueMemberStatus.findAll({
    where: { member_id: user.id },
    attributes: ["issue_id"],
    raw: true,
  });
  const issueIds = assignments.map(a => a.issue_id);
  if (issueIds.length === 0) {
    return { issue_id: null };
  }
  const where = { issue_id: { [Op.in]: issueIds } };
  if (timeFilter) where.created_at = { [Op.lte]: timeFilter };
  return where;
};

// Count issues for a user (admin, member, assigned)
const getIssueCount = async (user, timeFilter = null, statusFilter = null) => {
  const whereClause = await getIssueWhereClause(user, timeFilter);
  if (whereClause.issue_id === null) return 0;
  if (statusFilter) {
    whereClause.status = statusFilter;
  }
  return await Issue.count({ where: whereClause });
};

// Generic count for User model with optional created_at filter
const getUserCount = async (whereCondition, timeFilter = null) => {
  const where = { ...whereCondition };
  if (timeFilter) where.created_at = { [Op.lte]: timeFilter };
  return await User.count({ where });
};

const calcPercentChange = (current, prev) => {
  if (prev === 0) return current === 0 ? "0%" : "+100%";
  const change = ((current - prev) / prev) * 100;
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
};

/* ======================================================
   1. DASHBOARD DETAILS (role‑based)
====================================================== */
export const getDashboardDetails = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid user data" });
    }

    const user = await User.findByPk(userId, {
      attributes: ["member_type_id"],
    });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // ---------- ADMIN DASHBOARD ----------
    if (user.member_type_id === "ADM123456789") {
      const activeUserFilter = { status: "Approved", is_active: 1 };
      const allMembersFilter = {
        ...activeUserFilter,
        member_type_id: { [Op.in]: [1, 2,3,4,5] },
      };
      const professionalFilter = { ...activeUserFilter, member_type_id: 2 };
      const volunteerFilter = { ...activeUserFilter, member_type_id: 3 };
      const usersFilter = { ...activeUserFilter, member_type_id: 1 };
      const activeWorksFilter = { status: "In Progress" };
      const openIssuesFilter = { status: { [Op.notIn]: ["Resolved", "Closed"] } };
      const resolvedIssuesFilter = { status: "Resolved" };

      const [
        totalMembersCurrent, professionalVolunteersCurrent, volunteerMembersCurrent, usersCurrent,
        totalIssuesCurrent, activeWorksCurrent, openIssuesCurrent, resolvedIssuesCurrent,
      ] = await Promise.all([
        getUserCount(allMembersFilter),
        getUserCount(professionalFilter),
        getUserCount(volunteerFilter),
        getUserCount(usersFilter),
        Issue.count({}),
        Issue.count({ where: activeWorksFilter }),
        Issue.count({ where: openIssuesFilter }),
        Issue.count({ where: resolvedIssuesFilter }),
      ]);

      const completionRateCurrent = totalIssuesCurrent === 0 ? 0 : (resolvedIssuesCurrent / totalIssuesCurrent) * 100;

      const dashboardData = {
        allMembers: { current: totalMembersCurrent, change: "0%" },
        professionalVolunteers: { current: professionalVolunteersCurrent, change: "0%" },
        volunteerMembers: { current: volunteerMembersCurrent, change: "0%" },
        users: { current: usersCurrent, change: "0%" },
        totalIssues: { current: totalIssuesCurrent, change: "0%" },
        activeWorks: { current: activeWorksCurrent, change: "0%" },
        openIssues: { current: openIssuesCurrent, change: "0%" },
        resolvedIssues: { current: resolvedIssuesCurrent, change: "0%" },
        completionRate: { current: `${completionRateCurrent.toFixed(0)}%`, change: "0%" },
      };
      return res.status(200).json({ success: true, data: dashboardData });
    }

    // ---------- NON‑ADMIN DASHBOARD (personal stats) ----------
    const totalCurrent = await getIssueCount(user);
    const openCurrent = await getIssueCount(user, null, { [Op.notIn]: ["Resolved", "Closed"] });
    const resolvedCurrent = await getIssueCount(user, null, "Resolved");

    const completionRateCurrent = totalCurrent === 0 ? 0 : (resolvedCurrent / totalCurrent) * 100;

    const personalDashboard = {
      totalIssues: { current: totalCurrent, change: "0%" },
      openIssues: { current: openCurrent, change: "0%" },
      resolvedIssues: { current: resolvedCurrent, change: "0%" },
      completionRate: { current: `${completionRateCurrent.toFixed(0)}%`, change: "0%" },
      memberType: user.member_type_id,
    };
    return res.status(200).json({ success: true, data: personalDashboard });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};
/* ======================================================
   2. GROWTH OVERVIEW (role‑based)
====================================================== */
export const getGrowthOverview = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid user data" });
    }
    const user = await User.findByPk(userId, { attributes: ["member_type_id"] });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const isAdmin = user.member_type_id === "ADM123456789";
    const now = new Date();
    const months = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ start: d, name: d.toLocaleString('default', { month: 'short' }) });
    }

    if (isAdmin) {
      const growthData = [];
      for (const month of months) {
        const endDate = new Date(month.start.getFullYear(), month.start.getMonth() + 1, 1);
        const members = await User.count({
          where: {
            member_type_id: { [Op.in]: [1, 2, 3, 4, 5] },
            status: "Approved", is_active: 1,
            created_at: { [Op.gte]: month.start, [Op.lt]: endDate },
          },
        });
        const issues = await Issue.count({
          where: { created_at: { [Op.gte]: month.start, [Op.lt]: endDate } },
        });
        growthData.push({ name: month.name, Members: members, Issues: issues });
      }
      return res.status(200).json({ success: true, data: growthData });
    }

    // Non‑admin: personal issue growth (reported or assigned)
    const growthData = [];
    for (const month of months) {
      const endDate = new Date(month.start.getFullYear(), month.start.getMonth() + 1, 1);
      const whereClause = await getIssueWhereClause(user);
      if (whereClause.issue_id === null) {
        growthData.push({ name: month.name, "My Issues": 0 });
        continue;
      }
      whereClause.created_at = { [Op.gte]: month.start, [Op.lt]: endDate };
      const count = await Issue.count({ where: whereClause });
      growthData.push({ name: month.name, "My Issues": count });
    }
    return res.status(200).json({ success: true, data: growthData });
  } catch (error) {
    console.error("Growth overview error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* ======================================================
   3. STATE DISTRIBUTION (admin sees all; others see own)
====================================================== */
export const getStateDistribution = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid user data" });
    }
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (user.member_type_id === "ADM123456789") {
      const users = await User.findAll({
        where: {
          member_type_id: { [Op.in]: [1, 2, 3, 4, 5] },
          status: "Approved", is_active: 1,
        },
        attributes: ["address"],
      });
      const stateCounts = new Map();
      users.forEach(u => {
        let state = null;
        if (u.address && typeof u.address === 'object') state = u.address.state;
        else if (typeof u.address === 'string') {
          try { const parsed = JSON.parse(u.address); state = parsed.state; } catch(e) {}
        }
        if (state && typeof state === 'string') {
          const normalized = state.trim();
          stateCounts.set(normalized, (stateCounts.get(normalized) || 0) + 1);
        }
      });
      let distribution = Array.from(stateCounts.entries()).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
      const topN = 6;
      let result = distribution.slice(0, topN);
      if (distribution.length > topN) {
        const othersSum = distribution.slice(topN).reduce((sum, s) => sum + s.value, 0);
        result.push({ name: "Others", value: othersSum });
      }
      const colorPalette = ["#FB923C", "#F87171", "#60A5FA", "#34D399", "#FBBF24", "#A78BFA", "#94A3B8"];
      result = result.map((item, idx) => ({ ...item, color: colorPalette[idx % colorPalette.length] }));
      return res.status(200).json({ success: true, data: result });
    }

    // Non‑admin: own state
    let userState = null;
    const address = user.address;
    if (address && typeof address === 'object') userState = address.state;
    else if (typeof address === 'string') {
      try { const parsed = JSON.parse(address); userState = parsed.state; } catch(e) {}
    }
    const result = userState ? [{ name: userState.trim(), value: 1, color: "#FB923C" }] : [];
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("State distribution error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* ======================================================
   4. RECENT ISSUES (role‑based with my_issue_status for professionals/volunteers)
      - Admin: all issues (limited)
      - Member: own reported issues
      - professional_volunteer / volunteer_member: assigned issues, filtered out those accepted by others,
        and includes their personal status (pending/accept)
====================================================== */
export const getRecentIssues = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid user data" });
    }

    const user = await User.findByPk(userId, {
      attributes: ["id", "member_type_id"]
    });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const limit = parseInt(req.query.limit) || 5;

    // Admin case – just return recent issues without extra statuses
    if (user.member_id === "ADM123456789") {
      const recentIssues = await Issue.findAll({
        order: [["created_at", "DESC"]],
        limit: limit,
        attributes: ["issue_id", "title", "status", "issue_type", "created_date", "created_at"],
      });
      const formatted = recentIssues.map(issue => ({
        issue_id: issue.issue_id,
        title: issue.title,
        status: issue.status,
        type: issue.issue_type || "General",
        date: issue.created_date || issue.created_at?.toISOString().split("T")[0],
      }));
      return res.status(200).json({ success: true, data: formatted });
    }

    // Member case – own reported issues
    if (user.member_type_id === "member") {
      const recentIssues = await Issue.findAll({
        where: { user_id: user.id },
        order: [["created_at", "DESC"]],
        limit: limit,
        attributes: ["issue_id", "title", "status", "issue_type", "created_date", "created_at"],
      });
      const formatted = recentIssues.map(issue => ({
        issue_id: issue.issue_id,
        title: issue.title,
        status: issue.status,
        type: issue.issue_type || "General",
        date: issue.created_date || issue.created_at?.toISOString().split("T")[0],
      }));
      return res.status(200).json({ success: true, data: formatted });
    }

    // Professional volunteer / volunteer member – assigned issues with their status,
    // excluding issues already accepted by another member.
    const memberIssues = await IssueMemberStatus.findAll({
      where: { member_id: user.id },
      attributes: ["issue_id"],
      raw: true
    });
    const assignedIssueIds = memberIssues.map(item => item.issue_id);
    if (assignedIssueIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Get all statuses for these issues to detect accept by others
    const allStatuses = await IssueMemberStatus.findAll({
      where: { issue_id: { [Op.in]: assignedIssueIds } },
      attributes: ["issue_id", "member_id", "issue_status"],
      raw: true
    });

    const issuesAcceptedByOthers = new Set();
    allStatuses.forEach(status => {
      if (status.issue_status === "accept" && status.member_id !== user.id) {
        issuesAcceptedByOthers.add(status.issue_id);
      }
    });

    const filteredIssueIds = assignedIssueIds.filter(id => !issuesAcceptedByOthers.has(id));
    if (filteredIssueIds.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Fetch the issues with reporter info (user)
    const issues = await Issue.findAll({
      where: { id: { [Op.in]: filteredIssueIds } },
      order: [["created_at", "DESC"]],
      limit: limit,
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "full_name", "email1", "mobile_1", "photo"],
        }
      ],
    });

    // Fetch the current user's status for each issue
    const userStatuses = await IssueMemberStatus.findAll({
      where: {
        issue_id: { [Op.in]: filteredIssueIds },
        member_id: user.id
      },
      attributes: ["issue_id", "issue_status", "remarks", "created_at", "updated_at"],
      raw: true
    });
    const statusMap = {};
    userStatuses.forEach(st => {
      statusMap[st.issue_id] = {
        status: st.issue_status,
        remarks: st.remarks,
        assigned_at: st.created_at,
        responded_at: st.updated_at
      };
    });

    const transformed = issues.map(issue => {
      const issueData = issue.toJSON();
      return {
        id: issueData.id,
        issue_id: issueData.issue_id,
        title: issueData.title,
        description: issueData.description,
        issue_type: issueData.issue_type,
        status: issueData.status,
        contact_mobile: issueData.contact_mobile,
        current_address: issueData.current_address,
        created_date: issueData.created_date,
        assigned_date: issueData.assigned_date,
        user: issueData.user,
        my_issue_status: statusMap[issueData.id] || {
          status: "pending",
          remarks: null,
          assigned_at: null,
          responded_at: null
        }
      };
    });

    return res.status(200).json({ success: true, data: transformed });
  } catch (error) {
    console.error("Recent issues error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* ======================================================
   5. RECENT ACTIVITIES (user's own notifications)
====================================================== */
export const getRecentActivities = async (req, res) => {
  try {
    const userId = getUserId(req.user);
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid user data" });
    }

    const limit = parseInt(req.query.limit) || 5;
    const notifications = await Notification.findAll({
      where: { user_id: userId },
      order: [["created_at", "DESC"]],
      limit,
      attributes: ["id", "message", "created_at", "detail", "message_type"],
    });

    const activities = notifications.map(notif => {
      let user = "", action = "", target = "", type = notif.message_type;
      let detail = {};
      if (notif.detail) {
        try { detail = typeof notif.detail === "string" ? JSON.parse(notif.detail) : notif.detail; } catch(e) {}
      }
      const msg = notif.message;
      if (msg.includes("registration request from")) {
        const match = msg.match(/from (.+?)\./);
        user = match ? match[1] : "Someone";
        action = "registered as";
        target = detail.member_type_id || "member";
      } else if (msg.includes("created a new Member:")) {
        const match = msg.match(/(.+?) created a new Member: (.+?)\./);
        user = match ? match[1] : "Someone";
        action = "created member";
        target = match ? match[2] : "";
      } else if (msg.includes("registration request has been APPROVED")) {
        user = detail.full_name || "User";
        action = "registration approved";
      } else if (msg.includes("Please review and approve")) {
        user = detail.member_name || "New member";
        action = "requires approval";
      } else {
        user = "System";
        action = msg;
      }
      return { id: notif.id, user, action, target, time: notif.created_at, type, raw_message: msg };
    });

    return res.status(200).json({ success: true, data: activities });
  } catch (error) {
    console.error("Recent activities error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* ======================================================
   6. ASSIGN ISSUE (admin only)
      Creates entry in IssueMemberStatus and in‑app notification
====================================================== */
export const assignIssue = async (req, res) => {
  try {
    const adminId = getUserId(req.user);
    if (!adminId) {
      return res.status(401).json({ success: false, message: "Unauthorized: Invalid user data" });
    }

    const admin = await User.findByPk(adminId);
    if (!admin || admin.member_type_id !== "admin") {
      return res.status(403).json({ success: false, message: "Forbidden: Admin access required" });
    }

    const { issue_id, member_id, remarks } = req.body;
    if (!issue_id || !member_id) {
      return res.status(400).json({ success: false, message: "issue_id and member_id are required" });
    }

    const issue = await Issue.findByPk(issue_id);
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });

    const member = await User.findByPk(member_id);
    if (!member) return res.status(404).json({ success: false, message: "Member not found" });
    if (!["professional_volunteer", "volunteer_member"].includes(member.member_type_id)) {
      return res.status(400).json({ success: false, message: "Issue can only be assigned to professional_volunteer or volunteer_member" });
    }

    // Check for active assignment (pending or accept) from any member
    const existing = await IssueMemberStatus.findOne({
      where: { issue_id, issue_status: { [Op.in]: ["pending", "accept"] } }
    });
    if (existing) {
      return res.status(400).json({ success: false, message: "This issue is already assigned to another member and not yet resolved" });
    }

    const assignment = await IssueMemberStatus.create({
      issue_id,
      member_id,
      issue_status: "pending",
      remarks: remarks || null,
      created_at: new Date(),
      updated_at: new Date()
    });

    if (issue.status === "Pending" || issue.status === "Open") {
      await issue.update({ status: "In Progress", assigned_date: new Date() });
    }

    await Notification.create({
      user_id: member_id,
      message: `New issue assigned to you: ${issue.title} (${issue.issue_id})`,
      message_type: "issue_assignment",
      is_read: 0,
      detail: {
        issue_id: issue.id,
        issue_number: issue.issue_id,
        title: issue.title,
        assigned_by: admin.full_name || admin.name,
        remarks: remarks
      },
      photo: "bell-icon.webp"
    });

    return res.status(200).json({
      success: true,
      message: "Issue assigned successfully",
      data: assignment
    });
  } catch (error) {
    console.error("Assign issue error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};