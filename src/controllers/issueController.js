import db from "../models/index.js";
import { Op, Sequelize } from "sequelize";

const Issue = db.Issue;
const User = db.User;
const IssueMemberStatus = db.IssueMemberStatus;

/* ======================================================
   CREATE ISSUE
====================================================== */
export const createIssue = async (req, res) => {
  try {
    const {
      issue_id,
      user_id,
      assigned_by,
      issue_type,
      title,
      description,
      contact_mobile,
      current_address,
      status,
      assigned_date,
    } = req.body;

    const created_date = new Date();
    
    const issue = await Issue.create({
      issue_id,
      user_id,
      assigned_by,
      issue_type,
      title,
      description,
      contact_mobile,
      current_address,
      status,
      created_date,
      assigned_date,
    });

    return res.status(201).json({
      message: "Issue created successfully",
      data: issue,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error creating issue",
      error,
    });
  }
};

/* ======================================================
   GET ALL ISSUES (PAGINATION)
   - Excludes issues where another member has already accepted
====================================================== */
export const getAllIssues = async (req, res) => {
  try {
    const loggedUserId = req.user.id;
    const isAdmin = req.user.member_type === "admin";

    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const offset = (page - 1) * limit;

    // WHERE CONDITION
    let whereCondition = {};

    // If NOT admin -> show only issues where user is assigned
    if (!isAdmin) {
      // Get all issue_ids where this member is assigned
      const memberIssues = await IssueMemberStatus.findAll({
        where: {
          member_id: loggedUserId
        },
        attributes: ['issue_id'],
        raw: true
      });

      const assignedIssueIds = memberIssues.map(item => item.issue_id);

      if (assignedIssueIds.length === 0) {
        return res.status(200).json({
          success: true,
          total: 0,
          page,
          limit,
          totalPages: 0,
          data: [],
          message: "No issues assigned to you"
        });
      }

      // Get all issue statuses to check if any other member has accepted
      const allIssueStatuses = await IssueMemberStatus.findAll({
        where: {
          issue_id: { [Op.in]: assignedIssueIds }
        },
        attributes: ['issue_id', 'member_id', 'issue_status'],
        raw: true
      });

      // Find issues where another member has already accepted
      const issuesWithAcceptedByOthers = new Set();
      allIssueStatuses.forEach(status => {
        // If someone else (not current user) has accepted this issue
        if (status.issue_status === 'accept' && status.member_id !== loggedUserId) {
          issuesWithAcceptedByOthers.add(status.issue_id);
        }
      });

      // Filter out issues that have been accepted by others
      const filteredIssueIds = assignedIssueIds.filter(
        issueId => !issuesWithAcceptedByOthers.has(issueId)
      );

      if (filteredIssueIds.length === 0) {
        return res.status(200).json({
          success: true,
          total: 0,
          page,
          limit,
          totalPages: 0,
          data: [],
          message: "No pending issues available. Issues assigned to you have been accepted by other members."
        });
      }

      whereCondition = {
        id: {
          [Op.in]: filteredIssueIds
        }
      };
    }

    const { count, rows } = await Issue.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["id", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: ['id', 'full_name', 'email', 'mobile_1', 'photo']
        },
        {
          model: User,
          as: "assignedBy",
          attributes: ['id', 'full_name', 'email', 'member_type']
        }
      ],
    });

    // For non-admin users, fetch their statuses separately
    let transformedRows = rows;
    
    if (!isAdmin && rows.length > 0) {
      const issueIds = rows.map(issue => issue.id);
      
      const memberStatuses = await IssueMemberStatus.findAll({
        where: {
          issue_id: { [Op.in]: issueIds },
          member_id: loggedUserId
        },
        attributes: ['issue_id', 'issue_status', 'remarks', 'created_at', 'updated_at'],
        raw: true
      });
      
      const statusMap = {};
      memberStatuses.forEach(status => {
        statusMap[status.issue_id] = {
          status: status.issue_status,
          remarks: status.remarks,
          assigned_at: status.created_at,
          responded_at: status.updated_at
        };
      });
      
      transformedRows = rows.map(issue => {
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
            status: 'pending',
            remarks: null,
            assigned_at: null,
            responded_at: null
          }
        };
      });
    }

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: transformedRows,
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error fetching issues",
      error: error.message,
    });
  }
};


/* ======================================================
   GET ISSUES BY USER ID (PAGINATION)
====================================================== */
export const getAllIssuesByUserId = async (req, res) => {
  try {

    const { id } = req.params;
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const offset = (page - 1) * limit;

    const { count, rows } = await Issue.findAndCountAll({
      where: { user_id: id },
      limit,
      offset,
      order: [["id", "DESC"]],
      include: [
        { model: User, as: "user" },
        { model: User, as: "assignedBy" },
      ],
    });

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: rows,
    });

  } catch (error) {
    return res.status(500).json({
      message: "Error fetching user issues",
      error: error.message,
    });
  }
};


/* ======================================================
   GET ISSUES BY ASSIGNED BY ID (WITH MEMBER STATUS)
   - Only returns current member's status
====================================================== */
export const getAllIssuesById = async (req, res) => {
  try {
    const { id } = req.params; // assigned_by user ID
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    const memberId = parseInt(id);

    // For MySQL - search for member_id in JSON array using Sequelize.literal
    const whereCondition = Sequelize.where(
      Sequelize.fn('JSON_CONTAINS', Sequelize.col('assigned_by'), JSON.stringify(memberId)),
      1
    );

    // First, get all issues assigned to this member (where member_id exists in assigned_by JSON array)
    const { count, rows } = await Issue.findAndCountAll({
      where: whereCondition,
      limit,
      offset,
      order: [["id", "DESC"]],
      include: [
        {
          model: User,
          as: "user",
          attributes: ['id', 'full_name', 'email', 'mobile_1', 'photo', 'member_type']
        }
      ],
    });

    if (rows.length === 0) {
      return res.status(200).json({
        success: true,
        total: 0,
        page,
        limit,
        totalPages: 0,
        data: [],
        message: "No issues found assigned to this member"
      });
    }

    // Get all issue IDs
    const issueIds = rows.map(issue => issue.id);

    // Get ONLY current member's statuses for these issues (not all members)
    const memberStatuses = await IssueMemberStatus.findAll({
      where: {
        issue_id: { [Op.in]: issueIds },
        member_id: memberId  // Only get status for the current member
      },
      attributes: ['id', 'issue_id', 'member_id', 'issue_status', 'remarks', 'created_at', 'updated_at'],
      order: [['created_at', 'DESC']],
      raw: true
    });

    // Create a map of issue_id to member status
    const statusMap = {};
    memberStatuses.forEach(status => {
      statusMap[status.issue_id] = {
        id: status.id,
        member_id: status.member_id,
        issue_status: status.issue_status,
        remarks: status.remarks,
        assigned_at: status.created_at,
        responded_at: status.updated_at
      };
    });

    // Transform rows with member statuses (only current member's status)
    const transformedRows = rows.map(issue => {
      const issueData = issue.toJSON();
      
      // Parse assigned_by JSON if it's a string
      let assignedByArray = issueData.assigned_by;
      if (typeof assignedByArray === 'string') {
        try {
          assignedByArray = JSON.parse(assignedByArray);
        } catch(e) {
          assignedByArray = [];
        }
      }
      
      // Get current member's status for this issue
      const currentMemberStatus = statusMap[issueData.id] || null;
      
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
        assigned_by: assignedByArray,
        assigned_to_me: assignedByArray.includes(memberId),
        my_issue_status: currentMemberStatus ? {
          id: currentMemberStatus.id,
          status: currentMemberStatus.issue_status,
          remarks: currentMemberStatus.remarks,
          assigned_at: currentMemberStatus.assigned_at,
          responded_at: currentMemberStatus.responded_at
        } : {
          status: 'pending',
          remarks: null,
          assigned_at: null,
          responded_at: null
        }
      };
    });

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: transformedRows,
    });

  } catch (error) {
    console.error("Error fetching assigned issues:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching assigned issues",
      error: error.message,
    });
  }
};

/* ======================================================
   GET SINGLE ISSUE
====================================================== */
/* ======================================================
   GET SINGLE ISSUE WITH ASSIGNED PROFESSIONALS DETAILS
====================================================== */
export const getIssueById = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await Issue.findByPk(id, {
      include: [
        { model: User, as: "user" },
        { model: User, as: "assignedBy" }
      ],
    });

    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found",
      });
    }

    // Convert issue to plain object
    const issueData = issue.toJSON();

    // Check if assigned_by is an array and has values
    if (issueData.assigned_by && Array.isArray(issueData.assigned_by) && issueData.assigned_by.length > 0) {
      // Fetch professional details for all assigned IDs
      const professionals = await User.findAll({
        where: {
          id: issueData.assigned_by,
          is_active: true,
          status: "approved"
        },
        attributes: [
          'id', 'full_name', 'member_type', 'profession', 'email',
          'mobile_1', 'mobile_2', 'photo', 'years_of_experience',
          'organization', 'city', 'district', 'state', 'address'
        ]
      });

      // Add assigned professionals details to the response
      issueData.assigned_professionals = professionals.map(prof => ({
        id: prof.id,
        name: prof.full_name,
        member_id: prof.member_id || `MEM${prof.id}`,
        profession: prof.profession,
        email: prof.email,
        mobile_1: prof.mobile_1,
        mobile_2: prof.mobile_2,
        years_of_experience: prof.years_of_experience,
        photo: prof.photo,
        organization: prof.organization,
        city: prof.city,
        district: prof.district,
        state: prof.state,
        address: prof.address,
        member_type: prof.member_type
      }));
    } else {
      issueData.assigned_professionals = [];
    }

    return res.status(200).json({
      success: true,
      data: issueData
    });
  } catch (error) {
    console.error("Error fetching issue:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching issue",
      error: error.message,
    });
  }
};

/* ======================================================
   UPDATE ISSUE
====================================================== */
export const updateIssue = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await Issue.findByPk(id);

    if (!issue) {
      return res.status(404).json({
        message: "Issue not found",
      });
    }

    await issue.update(req.body);

    return res.status(200).json({
      message: "Issue updated successfully",
      data: issue,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error updating issue",
      error,
    });
  }
};

/* ======================================================
   UPDATE ISSUE STATUS
====================================================== */
export const updateIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const issue = await Issue.findByPk(id);

    if (!issue) {
      return res.status(404).json({
        message: "Issue not found",
      });
    }

    issue.status = status;
    await issue.save();

    return res.status(200).json({
      message: "Issue status updated",
      data: issue,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error updating status",
      error,
    });
  }
};

/* ======================================================
   DELETE ISSUE
====================================================== */
export const deleteIssue = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await Issue.findByPk(id);

    if (!issue) {
      return res.status(404).json({
        message: "Issue not found",
      });
    }

    await issue.destroy();

    return res.status(200).json({
      message: "Issue deleted successfully",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error deleting issue",
      error,
    });
  }
};


/* ======================================================
   ASSIGN MULTIPLE PROFESSIONALS TO ISSUE
====================================================== */
export const assignMultipleProfessionals = async (req, res) => {
  try {
    const { issue_id, professional_ids } = req.body;
    const loginId = req.user.id;

    // Validate input
    if (!issue_id) {
      return res.status(400).json({
        success: false,
        message: "Issue ID is required"
      });
    }

    if (!professional_ids || !Array.isArray(professional_ids) || professional_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one professional ID is required"
      });
    }

    // Find the issue
    const issue = await Issue.findByPk(issue_id);
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found"
      });
    }

    // Find all professionals
    const professionals = await User.findAll({
      where: {
        id: professional_ids,
        member_type: {
          [Op.in]: ["professional_volunteer", "volunteer_member"]
        },
        status: "approved",
        is_active: true
      }
    });

    if (professionals.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No valid professionals found"
      });
    }

    // Get existing assigned professionals from IssueMemberStatus
    const existingAssignments = await IssueMemberStatus.findAll({
      where: {
        issue_id: parseInt(issue_id),
        member_id: professional_ids
      },
      attributes: ['member_id']
    });

    const existingIds = existingAssignments.map(e => e.member_id);
    const trulyNewProfessionalIds = professional_ids.filter(id => !existingIds.includes(id));

    if (trulyNewProfessionalIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "All selected professionals are already assigned to this issue"
      });
    }

    // Create pending status records for newly assigned professionals
    const memberStatusRecords = trulyNewProfessionalIds.map(member_id => ({
      issue_id: parseInt(issue_id),
      member_id: member_id,
      issue_status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    }));

    await IssueMemberStatus.bulkCreate(memberStatusRecords, {
      ignoreDuplicates: true
    });

    // Update assigned_by JSON field for backward compatibility
    let currentAssignments = [];
    if (issue.assigned_by) {
      try {
        currentAssignments = Array.isArray(issue.assigned_by) 
          ? issue.assigned_by 
          : JSON.parse(issue.assigned_by);
      } catch (e) {
        currentAssignments = [];
      }
    }
    
    const allAssignments = [...new Set([...currentAssignments, ...trulyNewProfessionalIds])];
    
    await issue.update({
      assigned_by: allAssignments,
      assigned_date: new Date(),
      status: issue.status === "Pending" ? "In Progress" : issue.status,
      updated_at: new Date()
    });

    // Fetch the updated issue with all details
    const updatedIssue = await Issue.findByPk(issue_id, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ['id', 'full_name', 'email', 'mobile_1']
        },
        {
          model: User,
          as: "assignedMembers",
          through: { attributes: ['issue_status', 'remarks'] },
          attributes: ['id', 'full_name', 'member_type', 'profession', 'email', 'mobile_1', 'mobile_2', 'photo', 'years_of_experience']
        }
      ]
    });

    return res.status(200).json({
      success: true,
      message: `${trulyNewProfessionalIds.length} professional(s) assigned successfully`,
      data: updatedIssue
    });

  } catch (error) {
    console.error("Error assigning professionals:", error);
    return res.status(500).json({
      success: false,
      message: "Error assigning professionals",
      error: error.message
    });
  }
};

/* ======================================================
   UPDATE ISSUE MEMBER STATUS (ACCEPT/REJECT)
   - Using id from params and status from body
====================================================== */
export const updateIssueMemberStatus = async (req, res) => {
  try {
    const { id } = req.params; // issue_id from URL params
    const { status, remarks } = req.body; // status from request body
    const loginId = req.user.id;
    const member_id = loginId;

    // Validate input
    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Issue ID is required"
      });
    }

    if (!status || !['accept', 'reject', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid issue status (accept/reject/pending) is required"
      });
    }

    // Find the issue
    const issue = await Issue.findByPk(parseInt(id));
    if (!issue) {
      return res.status(404).json({
        success: false,
        message: "Issue not found"
      });
    }

    // Check if member is assigned to this issue
    const memberAssignment = await IssueMemberStatus.findOne({
      where: {
        issue_id: parseInt(id),
        member_id: parseInt(member_id)
      }
    });

    if (!memberAssignment) {
      return res.status(403).json({
        success: false,
        message: "You are not assigned to this issue"
      });
    }

    // Update member status
    await memberAssignment.update({
      issue_status: status,
      remarks: remarks || memberAssignment.remarks,
      updated_at: new Date()
    });

    // Get all member statuses for this issue
    const allMemberStatuses = await IssueMemberStatus.findAll({
      where: { issue_id: parseInt(id) }
    });

    // Calculate summary
    const totalMembers = allMemberStatuses.length;
    const acceptedCount = allMemberStatuses.filter(s => s.issue_status === 'accept').length;
    const rejectedCount = allMemberStatuses.filter(s => s.issue_status === 'reject').length;
    const pendingCount = allMemberStatuses.filter(s => s.issue_status === 'pending').length;

    // Update issue status based on member responses
    let newIssueStatus = issue.status;

    if (acceptedCount === totalMembers && totalMembers > 0) {
      newIssueStatus = 'Resolved';
    } else if (rejectedCount === totalMembers && totalMembers > 0) {
      newIssueStatus = 'Not-Resolved';
    } else if (acceptedCount > 0 || rejectedCount > 0) {
      newIssueStatus = 'In Progress';
    }

    // Update issue with new status
    await issue.update({
      status: newIssueStatus,
      updated_at: new Date()
    });

    // Get updated member status with member details
    const updatedMemberStatus = await IssueMemberStatus.findOne({
      where: {
        issue_id: parseInt(id),
        member_id: parseInt(member_id)
      },
      include: [
        {
          model: User,
          as: "member",
          attributes: ['id', 'full_name', 'member_type', 'mobile_1', 'email', 'profession']
        }
      ]
    });

    return res.status(200).json({
      success: true,
      message: `Issue ${status === 'accept' ? 'accepted' : status === 'reject' ? 'rejected' : 'updated to pending'} successfully`,
      data: {
        issue_id: parseInt(id),
        member_id: parseInt(member_id),
        my_status: {
          id: updatedMemberStatus.id,
          status: updatedMemberStatus.issue_status,
          remarks: updatedMemberStatus.remarks,
          assigned_at: updatedMemberStatus.created_at,
          responded_at: updatedMemberStatus.updated_at
        },
        issue_status_updated: newIssueStatus,
        summary: {
          total_assigned: totalMembers,
          accepted: acceptedCount,
          rejected: rejectedCount,
          pending: pendingCount
        }
      }
    });

  } catch (error) {
    console.error("Error updating member status:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating status",
      error: error.message
    });
  }
};

/* ======================================================
   GET ISSUE MEMBER STATUSES
====================================================== */
export const getIssueMemberStatuses = async (req, res) => {
  try {
    const { issue_id } = req.params;

    const memberStatuses = await IssueMemberStatus.findAll({
      where: { issue_id: parseInt(issue_id) },
      include: [
        {
          model: User,
          as: "member",
          attributes: ['id', 'full_name', 'member_type', 'mobile_1', 'email', 'profession', 'photo']
        }
      ],
      order: [['id', 'ASC']]
    });

    const summary = {
      total: memberStatuses.length,
      accepted: memberStatuses.filter(s => s.issue_status === 'accept').length,
      rejected: memberStatuses.filter(s => s.issue_status === 'reject').length,
      pending: memberStatuses.filter(s => s.issue_status === 'pending').length
    };

    return res.status(200).json({
      success: true,
      data: {
        member_statuses: memberStatuses,
        summary: summary
      }
    });

  } catch (error) {
    console.error("Error fetching member statuses:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching member statuses",
      error: error.message
    });
  }
};