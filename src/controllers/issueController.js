import db from "../models/index.js";
import { Op, Sequelize } from "sequelize";
import nodemailer from "nodemailer";
import { sendPushToUser } from "../services/pushService.js";

const Issue = db.Issue;
const Category = db.Category;
const User = db.User;
const IssueMemberStatus = db.IssueMemberStatus;
const Notification = db.Notification;

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

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

    // Create the issue
    const issue = await Issue.create({
      issue_id,
      user_id,
      assigned_by,
      issue_type,
      title,
      description,
      contact_mobile,
      current_address: current_address || null,
      status: status || "Pending",
      created_date,
      assigned_date: assigned_date || null,
    });

    // Fetch the member who created the issue
    let member = null;
    try {
      member = await User.findByPk(user_id, {
        attributes: ['id', 'full_name', 'email1', 'mobile1']
      });
    } catch (err) {
      console.error("Error fetching member:", err);
    }

    // Fetch all admin users
    let admins = [];
    try {
      admins = await User.findAll({
        where: {
          member_id: "ADM123456789",
          status: "Approved",
          is_active: true
        },
        attributes: ['id', 'full_name', 'email1'] // Make sure push_token is included
      });
    } catch (err) {
      console.error("Error fetching admins:", err);
    }

    let notificationSentCount = 0;
    let emailSentCount = 0;
    let pushSentCount = 0;
    let failedNotifications = [];

    // Only proceed if there are admins
    if (admins && admins.length > 0) {
      // Create notification message for admins
      const adminNotificationMessage = `New Issue Reported\n\nMember: ${member?.full_name || 'Unknown'}\nType: ${issue_type}\nTitle: ${title}\nID: ${issue_id}`;
      const pushTitle = "🔔 New Issue Reported";
      const pushBody = `${member?.full_name || 'Member'} reported a new issue: ${title}`;

      // Send notifications, emails, and push notifications to all admins
      for (const admin of admins) {
        try {
          // Create in-app notification for admin
          await Notification.create({
            user_id: admin.id,
            message: adminNotificationMessage,
            message_type: "issue_report",
            is_read: 0,
            detail: {
              issue_id: issue.id,
              issue_number: issue_id,
              issue_type: issue_type,
              title: title,
              description: description,
              reported_by: member ? {
                id: member.id,
                name: member.full_name,
                email1: member.email1,
                mobile: member.mobile1
              } : null,
              current_address: current_address,
              created_date: created_date
            },
            member_photo: "bell-icon.webp"
          });
          notificationSentCount++;

          // Send email1 to admin
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                        color: white;
                        padding: 30px;
                        text-align: center;
                        border-radius: 10px 10px 0 0;
                    }
                    .content {
                        background: #f9fafb;
                        padding: 30px;
                        border-radius: 0 0 10px 10px;
                        border: 1px solid #e5e7eb;
                        border-top: none;
                    }
                    .issue-details {
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                        border-left: 4px solid #ef4444;
                    }
                    .member-info {
                        background: #fef3c7;
                        padding: 15px;
                        border-radius: 8px;
                        margin: 20px 0;
                        border-left: 4px solid #f59e0b;
                    }
                    .button {
                        display: inline-block;
                        background: #ef4444;
                        color: white;
                        padding: 12px 24px;
                        text-decoration: none;
                        border-radius: 6px;
                        margin: 20px 0;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 20px;
                        font-size: 12px;
                        color: #6b7280;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🆕 New Issue Reported</h1>
                    <p>Action Required</p>
                </div>
                
                <div class="content">
                    <p>Dear <strong>${admin.full_name}</strong>,</p>
                    
                    <p>A new issue has been reported by a community member. Please review and take appropriate action.</p>
                    
                    ${member ? `
                    <div class="member-info">
                        <h3 style="margin-top: 0; color: #f59e0b;">👤 Member Information</h3>
                        <p><strong>Name:</strong> ${member.full_name || 'Unknown'}</p>
                        <p><strong>Email:</strong> ${member.email1 || 'Not provided'}</p>
                        <p><strong>Mobile:</strong> ${member.mobile1 || 'Not provided'}</p>
                        <p><strong>Member Type:</strong> ${member.member_type_id?.replace(/_/g, ' ') || 'Unknown'}</p>
                    </div>
                    ` : ''}
                    
                    <div class="issue-details">
                        <h3 style="margin-top: 0; color: #ef4444;">📋 Issue Details</h3>
                        <p><strong>Issue ID:</strong> ${issue_id}</p>
                        <p><strong>Issue Type:</strong> ${issue_type}</p>
                        <p><strong>Title:</strong> ${title}</p>
                        <p><strong>Description:</strong></p>
                        <p style="background: #f3f4f6; padding: 10px; border-radius: 4px;">${description}</p>
                        ${contact_mobile ? `<p><strong>Contact Mobile:</strong> ${contact_mobile}</p>` : ''}
                        ${current_address ? `
                          <p><strong>Location:</strong></p>
                          <p style="background: #f3f4f6; padding: 10px; border-radius: 4px;">
                            ${current_address.street ? `${current_address.street}, ` : ''}
                            ${current_address.area ? `${current_address.area}, ` : ''}
                            ${current_address.city ? `${current_address.city}, ` : ''}
                            ${current_address.district ? `${current_address.district}, ` : ''}
                            ${current_address.state ? `${current_address.state} - ` : ''}
                            ${current_address.pincode ? `${current_address.pincode}` : ''}
                          </p>
                        ` : ''}
                        <p><strong>Reported Date:</strong> ${new Date(created_date).toLocaleString()}</p>
                    </div>
                    
                    <center>
                        <a href="${process.env.FRONTEND_URL || 'http://localhost:8080'}/dashboard/issues/${issue.id}" class="button">
                            🔍 View Issue Details
                        </a>
                    </center>
                    
                    <hr style="margin: 20px 0;">
                    
                    <p><strong>Next Steps:</strong></p>
                    <ul>
                        <li>Review the issue details</li>
                        <li>Assign the issue to appropriate volunteer</li>
                        <li>Update issue status as needed</li>
                        <li>Communicate with the member</li>
                    </ul>
                    
                    <p>Best regards,<br>
                    <strong>Ediga Community Team</strong></p>
                </div>
                
                <div class="footer">
                    <p>© 2025 Ediga Community. All rights reserved.</p>
                    <p>This is an automated message, please do not reply directly to this email1.</p>
                </div>
            </body>
            </html>
          `;

          await transporter.sendMail({
            from: `"Ediga Community" <${process.env.EMAIL_USER}>`,
            to: admin.email1,
            subject: `🆕 New Issue Reported: ${issue_id} - ${title}`,
            html: emailHtml
          });
          emailSentCount++;

        } catch (adminError) {
          console.error(`Failed to send email1 to admin ${admin.id}:`, adminError);
          failedNotifications.push({
            admin_id: admin.id,
            email1: admin.email1,
            type: 'email1',
            error: adminError.message
          });
        }
      }

      // PUSH NOTIFICATIONS - Non-blocking (similar to member registration)
      const pushPromises = admins.map(async (admin) => {
        try {
          const result = await sendPushToUser({
            userId: admin.id,
            title: pushTitle,
            body: pushBody,
            click_action: "https://edigacommunity.innogenx.co.in/dashboard/issues-management",
            icon: "https://edigacommunity.innogenx.co.in/logo.webp",
            data: {
              type: "issue_report",
              issue_id: String(issue.id),
              issue_number: String(issue_id),
              issue_type: String(issue_type),
              title: String(title),
              description: String(description),
              reported_by_id: member ? String(member.id) : null,
              reported_by_name: member ? String(member.full_name) : null,
              contact_mobile: String(contact_mobile || ''),
              timestamp: String(new Date().toISOString())
            }
          });

          pushSentCount++;
          return result;
        } catch (error) {
          console.error(`❌ Push error for admin ${admin.email1}:`, error.message);
          failedNotifications.push({
            admin_id: admin.id,
            email1: admin.email1,
            type: 'push',
            error: error.message
          });
          return { success: false, error: error.message };
        }
      });

      // Non-blocking push results - send but don't wait
      Promise.allSettled(pushPromises).then(results => {
        const successful = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
      }).catch(err => {
        console.error('Error in push notifications batch:', err);
      });

    }

    return res.status(201).json({
      success: true,
      message: "Issue created successfully",
      data: issue,
      stats: {
        admins_found: admins?.length || 0,
        notifications_sent: notificationSentCount,
        emails_sent: emailSentCount,
        push_notifications_sent: pushSentCount,
        failed: failedNotifications.length,
        member_notified: member ? true : false,
        failed_details: failedNotifications
      }
    });
  } catch (error) {
    console.error("Error creating issue:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating issue",
      error: error.message,
    });
  }
};


/* ======================================================
   GET ALL ISSUES (PAGINATION)
   - Excludes issues where another member has already accepted
====================================================== */
/* ======================================================
   GET ALL ISSUES (PAGINATION)
   - Admin (member_type_id === null) gets all issues
   - Members get only issues assigned to them
====================================================== */
export const getAllIssues = async (req, res) => {
  try {
    const loggedUserId = req.user.id;
    const isAdmin = req.user.member_type_id === null;

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
          attributes: ['id', 'full_name', 'email1', 'mobile1', 'member_photo']
        },
        {
          model: User,
          as: "assignedBy",
          attributes: ['id', 'full_name', 'email1']
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name"],
        },
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
          category_id: issueData.category_id,
          category_name: issueData.category?.category_name || null,
          status: issueData.status,
          contact_mobile: issueData.contact_mobile,
          current_address: issueData.current_address,
          created_date: issueData.created_date,
          assigned_date: issueData.assigned_date,
          user: issueData.user,
          assigned_by: issueData.assignedBy,
          my_issue_status: statusMap[issueData.id] || {
            status: 'pending',
            remarks: null,
            assigned_at: null,
            responded_at: null
          }
        };
      });
    } else if (isAdmin && rows.length > 0) {
      // For admin, include category_name but no my_issue_status
      transformedRows = rows.map(issue => {
        const issueData = issue.toJSON();
        return {
          id: issueData.id,
          issue_id: issueData.issue_id,
          title: issueData.title,
          description: issueData.description,
          issue_type: issueData.issue_type,
          category_id: issueData.category_id,
          category_name: issueData.category?.category_name || null,
          status: issueData.status,
          contact_mobile: issueData.contact_mobile,
          current_address: issueData.current_address,
          created_date: issueData.created_date,
          assigned_date: issueData.assigned_date,
          user: issueData.user,
          assigned_by: issueData.assignedBy,
          // Admin doesn't have my_issue_status
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
        { 
          model: User, 
          as: "user" 
        },
        { 
          model: User, 
          as: "assignedBy" 
        },
        {
          model: User,
          as: "assignedMembers",
          through: {
            attributes: ['issue_status', 'created_at', 'updated_at', 'send_to_members']
          },
          attributes: [
            'id', 
            'full_name', 
            'email1', 
            'mobile1', 
            'member_photo',
            'city',
            'state',
            'district',
            'profession_id',
            'specialization_id',
            'member_type_id'
          ]
        }
      ],
    });

    // Format the response to include assigned_by user details
    const formattedRows = rows.map(issue => {
      const issueData = issue.toJSON ? issue.toJSON() : issue;
      
      // Get assigned_by user details from the assignedBy association
      let assignedByDetails = null;
      if (issueData.assignedBy) {
        assignedByDetails = {
          id: issueData.assignedBy.id,
          full_name: issueData.assignedBy.full_name,
          email1: issueData.assignedBy.email1,
          mobile1: issueData.assignedBy.mobile1,
          member_photo: issueData.assignedBy.member_photo,
          member_type_id: issueData.assignedBy.member_type_id
        };
      }

      return {
        ...issueData,
        assigned_by_details: assignedByDetails,
        // Remove the raw assignedBy from response if you want cleaner output
        // assignedBy: undefined
      };
    });

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: formattedRows,
    });

  } catch (error) {
    console.error("Error fetching user issues:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching user issues",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};



/* ======================================================
   GET ISSUES ASSIGNED TO USER (Using issue_member_status table)
====================================================== */
export const getIssuesAssignedToUser = async (req, res) => {
  try {
    const { userId } = req.params;
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const offset = (page - 1) * limit;

    // Query issues through the issue_member_status table
    const { count, rows } = await Issue.findAndCountAll({
      include: [
        {
          model: IssueMemberStatus,
          as: "memberStatuses", // Correct alias from your model (plural)
          where: {
            member_id: userId,
            issue_status: {
              [Op.in]: ['pending', 'accept'] // Get both pending and accepted assignments
            }
          },
          required: true, // INNER JOIN - only get issues assigned to this user
          attributes: ['id', 'issue_status', 'remarks', 'created_at', 'updated_at']
        },
        {
          model: User,
          as: "user",
          attributes: ['id', 'full_name', 'email1', 'mobile1', 'member_photo']
        },
        {
          model: User,
          as: "assignedBy",
          attributes: ['id', 'full_name', 'email1', 'mobile1'],
          required: false // LEFT JOIN - assigned_by might be null
        }
      ],
      limit,
      offset,
      order: [["assigned_date", "DESC"]],
      distinct: true // Important for count with includes
    });

    // Format the response
    const formattedData = rows.map(issue => {
      const issueJSON = issue.toJSON();
      const memberStatus = issueJSON.memberStatuses?.[0]; // Get first member status

      // Remove memberStatuses from response
      delete issueJSON.memberStatuses;

      return {
        ...issueJSON,
        my_issue_status: memberStatus ? {
          status: memberStatus.issue_status,
          remarks: memberStatus.remarks,
          assigned_at: memberStatus.created_at,
          responded_at: memberStatus.updated_at
        } : null
      };
    });

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: formattedData,
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
          attributes: ['id', 'full_name', 'email1', 'mobile1', 'member_photo']
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
        } catch (e) {
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
// controllers/issueController.js

/* ======================================================
   GET SINGLE ISSUE WITH ASSIGNED MEMBERS
====================================================== */
export const getIssueById = async (req, res) => {
  try {
    const { id } = req.params;

    const issue = await Issue.findByPk(id, {
      include: [
        { 
          model: User, 
          as: "user",
          attributes: ['id', 'full_name', 'email1', 'mobile1', 'member_photo', 'member_type_id', 'pin_code']
        },
        { 
          model: User, 
          as: "assignedBy",
          attributes: ['id', 'full_name', 'email1', 'member_photo']
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name", "description", "is_active"],
        },
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

    // Fetch all assigned members from issue_member_status table
    const assignedMemberRecords = await IssueMemberStatus.findAll({
      where: {
        issue_id: parseInt(id)
      },
      attributes: ['member_id', 'issue_status', 'remarks', 'created_at', 'updated_at']
    });

    const assignedMemberIds = assignedMemberRecords.map(record => record.member_id);

    // Create a map of member status
    const memberStatusMap = {};
    assignedMemberRecords.forEach(record => {
      memberStatusMap[record.member_id] = {
        issue_status: record.issue_status,
        remarks: record.remarks,
        assigned_at: record.created_at,
        updated_at: record.updated_at
      };
    });

    // Fetch details for all assigned members
    let allAssignedMembers = [];

    if (assignedMemberIds.length > 0) {
      const members = await User.findAll({
        where: {
          id: { [Op.in]: assignedMemberIds },
          is_active: true,
          status: "approved"
        },
        attributes: [
          'id', 'full_name', 'email1', 'mobile1', 'mobile2', 
          'member_photo', 'city', 'district', 'state', 'address',
          'member_id', 'member_type_id', 'blood_group', 'age',
          'profession_id', 'specialization_id', 'organisation',
          'booth_no', 'pin_code', 'parent_name', 'website',
          'contact_person'
        ]
      });

      allAssignedMembers = members.map(member => ({
        id: member.id,
        name: member.full_name,
        member_id: member.member_id || `MEM${member.id}`,
        member_type_id: member.member_type_id,
        profession_id: member.profession_id,
        specialization_id: member.specialization_id,
        email1: member.email1,
        mobile1: member.mobile1,
        mobile2: member.mobile2,
        member_photo: member.member_photo,
        organisation: member.organisation,
        city: member.city,
        district: member.district,
        state: member.state,
        address: member.address,
        blood_group: member.blood_group,
        age: member.age,
        booth_no: member.booth_no,
        pin_code: member.pin_code,
        parent_name: member.parent_name,
        website: member.website,
        contact_person: member.contact_person,
        assignment_status: memberStatusMap[member.id]?.issue_status || 'pending',
        remarks: memberStatusMap[member.id]?.remarks || null,
        assigned_at: memberStatusMap[member.id]?.assigned_at,
        status_updated_at: memberStatusMap[member.id]?.updated_at
      }));
    }

    // Also check the assigned_by JSON field for backward compatibility
    let legacyAssignedIds = [];
    if (issueData.assigned_by && Array.isArray(issueData.assigned_by) && issueData.assigned_by.length > 0) {
      legacyAssignedIds = issueData.assigned_by;

      // Fetch any legacy assigned members not already in the list
      const existingIds = new Set(assignedMemberIds);
      const newLegacyIds = legacyAssignedIds.filter(id => !existingIds.has(id));

      if (newLegacyIds.length > 0) {
        const legacyMembers = await User.findAll({
          where: {
            id: { [Op.in]: newLegacyIds },
            is_active: true,
            status: "approved"
          },
          attributes: [
            'id', 'full_name', 'email1', 'mobile1', 'mobile2',
            'member_photo', 'city', 'district', 'state', 'address',
            'member_id', 'member_type_id', 'blood_group', 'age',
            'profession_id', 'specialization_id', 'organisation',
            'booth_no', 'pin_code'
          ]
        });

        const legacyMembersFormatted = legacyMembers.map(member => ({
          id: member.id,
          name: member.full_name,
          member_id: member.member_id || `MEM${member.id}`,
          member_type_id: member.member_type_id,
          profession_id: member.profession_id,
          specialization_id: member.specialization_id,
          email1: member.email1,
          mobile1: member.mobile1,
          mobile2: member.mobile2,
          member_photo: member.member_photo,
          organisation: member.organisation,
          city: member.city,
          district: member.district,
          state: member.state,
          address: member.address,
          blood_group: member.blood_group,
          age: member.age,
          booth_no: member.booth_no,
          pin_code: member.pin_code,
          assignment_status: 'pending',
          remarks: null,
          assigned_at: issueData.assigned_date,
          is_legacy: true
        }));

        allAssignedMembers = [...allAssignedMembers, ...legacyMembersFormatted];
      }
    }

    // Count statuses
    const pendingCount = allAssignedMembers.filter(m => m.assignment_status === 'pending').length;
    const acceptedCount = allAssignedMembers.filter(m => m.assignment_status === 'accept').length;
    const rejectedCount = allAssignedMembers.filter(m => m.assignment_status === 'reject').length;

    // Add to response
    issueData.assigned_members = allAssignedMembers;
    issueData.assignment_summary = {
      total_assigned: allAssignedMembers.length,
      pending: pendingCount,
      accepted: acceptedCount,
      rejected: rejectedCount
    };

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
   ASSIGN MULTIPLE MEMBERS TO ISSUE (Unified Endpoint)
   Supports: 
   - Admin assigning professional_volunteers/volunteer_members
   - Professional Volunteer assigning volunteer_members
   Compatible with existing issue_member_status table structure
====================================================== */


export const assignMultipleMembers = async (req, res) => {
  // Start a transaction for data consistency
  const transaction = await db.sequelize.transaction();

  try {
    const { issue_id, professional_ids, send_to_members } = req.body;

    // Validate issue_id
    if (!issue_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Issue ID is required"
      });
    }

    const issueId = parseInt(issue_id);

    // Validate professional_ids
    if (!professional_ids || !Array.isArray(professional_ids) || professional_ids.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "professional_ids must be provided as a non-empty array"
      });
    }

    // Find the issue with transaction
    const issue = await Issue.findByPk(issueId, { 
      transaction,
      include: [
        {
          model: User,
          as: "user",
          attributes: ['id', 'full_name', 'email1', 'mobile1', 'member_type_id']
        }
      ]
    });

    if (!issue) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Issue not found"
      });
    }

    // Find all members to assign (admin can assign any approved/active members with member_type_id = 2)
    const members = await User.findAll({
      where: {
        id: { [Op.in]: professional_ids },
        member_type_id: 2, // Only professional volunteers
        status: "Approved",
        is_active: true
      },
      transaction
    });

    if (members.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "No valid professional members found"
      });
    }

    // Get existing assigned members from IssueMemberStatus
    const existingAssignments = await IssueMemberStatus.findAll({
      where: {
        issue_id: issueId,
        member_id: { [Op.in]: professional_ids },
        user_id: issue.user_id,
      },
      attributes: ['member_id', 'issue_status', 'send_to_members'],
      transaction
    });

    const existingIds = existingAssignments.map(e => e.member_id);
    const trulyNewMemberIds = professional_ids.filter(id => !existingIds.includes(id));

    if (trulyNewMemberIds.length === 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "All selected professional members are already assigned to this issue",
        existing_assignments: existingAssignments
      });
    }

    // Filter to only get the actual member objects for newly assigned IDs
    const newlyAssignedMembers = members.filter(m => trulyNewMemberIds.includes(m.id));

    // Create pending status records for newly assigned members
    const memberStatusRecords = trulyNewMemberIds.map(member_id => ({
      issue_id: issueId,
      member_id: member_id,
      user_id: issue.user_id,
      issue_status: 'pending',
      send_to_members: send_to_members || false,
      created_at: new Date(),
      updated_at: new Date()
    }));

    await IssueMemberStatus.bulkCreate(memberStatusRecords, {
      ignoreDuplicates: true,
      transaction
    });

    // Update assigned_by JSON field for backward compatibility
    let currentAssignments = [];
    if (issue.assigned_by) {
      try {
        currentAssignments = Array.isArray(issue.assigned_by)
          ? issue.assigned_by
          : JSON.parse(issue.assigned_by);
        
        if (!Array.isArray(currentAssignments)) {
          currentAssignments = [];
        }
      } catch (e) {
        currentAssignments = [];
      }
    }

    const updatedAssignments = [...new Set([...currentAssignments, ...trulyNewMemberIds])];

    // Update issue status if it was pending
    let newIssueStatus = issue.status;
    if (issue.status === "Pending") {
      newIssueStatus = "In Progress";
    }

    await issue.update({
      assigned_by: updatedAssignments,
      assigned_date: new Date(),
      status: newIssueStatus,
      updated_at: new Date()
    }, { transaction });

    // Commit transaction
    await transaction.commit();

    // === SEND NOTIFICATIONS AND EMAILS ===
    let notificationSentCount = 0;
    let emailSentCount = 0;

    try {
      // 1. Send notifications to assigned professionals
      if (send_to_members && newlyAssignedMembers.length > 0) {
        // Get issue details for notification
        const issueType = issue.issue_type || 'General';
        const title = issue.title || 'Issue Assigned';
        const description = issue.description || '';
        const currentAddress = issue.current_address || null;
        const createdDate = issue.created_at || new Date();

        // Get reporter details (the user who created the issue)
        const reporter = issue.user;

        // Send notification to each assigned professional
        for (const professional of newlyAssignedMembers) {
          await Notification.create({
            user_id: professional.id,
            message: `You have been assigned to issue #${issueId}: ${title}`,
            message_type: "assigned_issue",
            is_read: 0,
            detail: {
              issue_id: issue.id,
              issue_number: issueId,
              issue_type: issueType,
              title: title,
              description: description,
              reported_by: reporter ? {
                id: reporter.id,
                name: reporter.full_name,
                email1: reporter.email1,
                mobile: reporter.mobile1
              } : null,
              current_address: currentAddress,
              created_date: createdDate,
              assigned_by: req.user?.full_name || 'Admin'
            },
            member_photo: "bell-icon.webp"
          });
          notificationSentCount++;

          // Send email to assigned professional
          const emailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                        color: white;
                        padding: 30px;
                        text-align: center;
                        border-radius: 10px 10px 0 0;
                    }
                    .content {
                        background: #f9fafb;
                        padding: 30px;
                        border-radius: 0 0 10px 10px;
                        border: 1px solid #e5e7eb;
                        border-top: none;
                    }
                    .issue-details {
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                        border-left: 4px solid #3b82f6;
                    }
                    .reporter-info {
                        background: #fef3c7;
                        padding: 15px;
                        border-radius: 8px;
                        margin: 20px 0;
                        border-left: 4px solid #f59e0b;
                    }
                    .button {
                        display: inline-block;
                        background: #3b82f6;
                        color: white;
                        padding: 12px 24px;
                        text-decoration: none;
                        border-radius: 6px;
                        margin: 20px 0;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 20px;
                        font-size: 12px;
                        color: #6b7280;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📋 Issue Assigned to You</h1>
                    <p>Action Required</p>
                </div>
                
                <div class="content">
                    <p>Dear <strong>${professional.full_name}</strong>,</p>
                    
                    <p>An issue has been assigned to you by <strong>${req.user?.full_name || 'Admin'}</strong>. Please review and take appropriate action.</p>
                    
                    ${reporter ? `
                    <div class="reporter-info">
                        <h3 style="margin-top: 0; color: #f59e0b;">👤 Reported By</h3>
                        <p><strong>Name:</strong> ${reporter.full_name || 'Unknown'}</p>
                        <p><strong>Email:</strong> ${reporter.email1 || 'Not provided'}</p>
                        <p><strong>Mobile:</strong> ${reporter.mobile1 || 'Not provided'}</p>
                    </div>
                    ` : ''}
                    
                    <div class="issue-details">
                        <h3 style="margin-top: 0; color: #3b82f6;">📋 Issue Details</h3>
                        <p><strong>Issue ID:</strong> ${issueId}</p>
                        <p><strong>Issue Type:</strong> ${issueType}</p>
                        <p><strong>Title:</strong> ${title}</p>
                        <p><strong>Description:</strong></p>
                        <p style="background: #f3f4f6; padding: 10px; border-radius: 4px;">${description}</p>
                        ${currentAddress ? `
                          <p><strong>Location:</strong></p>
                          <p style="background: #f3f4f6; padding: 10px; border-radius: 4px;">
                            ${currentAddress.street ? `${currentAddress.street}, ` : ''}
                            ${currentAddress.area ? `${currentAddress.area}, ` : ''}
                            ${currentAddress.city ? `${currentAddress.city}, ` : ''}
                            ${currentAddress.district ? `${currentAddress.district}, ` : ''}
                            ${currentAddress.state ? `${currentAddress.state} - ` : ''}
                            ${currentAddress.pincode ? `${currentAddress.pincode}` : ''}
                          </p>
                        ` : ''}
                        <p><strong>Reported Date:</strong> ${new Date(createdDate).toLocaleString()}</p>
                    </div>
                    
                    <center>
                        <a href="https://edigacommunity.innogenx.co.in/dashboard/issues-management" class="button">
                            🔍 View & Take Action
                        </a>
                    </center>
                    
                    <hr style="margin: 20px 0;">
                    
                    <p><strong>Next Steps:</strong></p>
                    <ul>
                        <li>Review the issue details</li>
                        <li>Plan the resolution approach</li>
                        <li>Update issue status as you work</li>
                        <li>Communicate with the reporter if needed</li>
                    </ul>
                    
                    <p>Best regards,<br>
                    <strong>Ediga Community Team</strong></p>
                </div>
                
                <div class="footer">
                    <p>© 2025 Ediga Community. All rights reserved.</p>
                    <p>This is an automated message, please do not reply directly to this email.</p>
                </div>
            </body>
            </html>
          `;

          await transporter.sendMail({
            from: `"Ediga Community" <${process.env.EMAIL_USER}>`,
            to: professional.email1,
            subject: `📋 Issue Assigned: #${issueId} - ${title}`,
            html: emailHtml
          });
          emailSentCount++;
        }

        // 2. If send_to_members is true, also notify the issue reporter
        if (reporter && reporter.id) {
          await Notification.create({
            user_id: reporter.id,
            message: `Your issue #${issueId}: ${title} has been assigned to ${newlyAssignedMembers.length} professional(s). Please check your email.`,
            message_type: "issue_assigned_to_volunteers",
            is_read: 0,
            detail: {
              issue_id: issue.id,
              issue_number: issueId,
              title: title,
              assigned_professionals: newlyAssignedMembers.map(m => ({
                id: m.id,
                name: m.full_name,
                email: m.email1,
                mobile: m.mobile1
              })),
              assigned_by: req.user?.full_name || 'Admin',
              assigned_date: new Date()
            },
            member_photo: "bell-icon.webp"
          });
          notificationSentCount++;

          // Send email to reporter
          const reporterEmailHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }
                    .header {
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                        color: white;
                        padding: 30px;
                        text-align: center;
                        border-radius: 10px 10px 0 0;
                    }
                    .content {
                        background: #f9fafb;
                        padding: 30px;
                        border-radius: 0 0 10px 10px;
                        border: 1px solid #e5e7eb;
                        border-top: none;
                    }
                    .professional-list {
                        background: white;
                        padding: 20px;
                        border-radius: 8px;
                        margin: 20px 0;
                        border-left: 4px solid #10b981;
                    }
                    .button {
                        display: inline-block;
                        background: #10b981;
                        color: white;
                        padding: 12px 24px;
                        text-decoration: none;
                        border-radius: 6px;
                        margin: 20px 0;
                    }
                    .footer {
                        text-align: center;
                        margin-top: 20px;
                        font-size: 12px;
                        color: #6b7280;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>✅ Issue Assigned to Volunteers</h1>
                    <p>Your issue is being processed</p>
                </div>
                
                <div class="content">
                    <p>Dear <strong>${reporter.full_name}</strong>,</p>
                    
                    <p>Good news! Your issue has been assigned to <strong>${newlyAssignedMembers.length}</strong> professional volunteer(s) by <strong>${req.user?.full_name || 'Admin'}</strong>.</p>
                    
                    <div class="professional-list">
                        <h3 style="margin-top: 0; color: #10b981;">👨‍💼 Assigned Professionals</h3>
                        ${newlyAssignedMembers.map((m, index) => `
                          <p><strong>${index + 1}.</strong> ${m.full_name}${m.mobile1 ? ` (${m.mobile1})` : ''}</p>
                        `).join('')}
                    </div>
                    
                    <p><strong>Issue #${issueId}:</strong> ${title}</p>
                    
                    <center>
                        <a href="https://edigacommunity.innogenx.co.in/dashboard/issues-management" class="button">
                            🔍 Track Your Issue
                        </a>
                    </center>
                    
                    <p>Our volunteers will review your issue and reach out to you soon. You can track the progress using the button above.</p>
                    
                    <p>Best regards,<br>
                    <strong>Ediga Community Team</strong></p>
                </div>
                
                <div class="footer">
                    <p>© 2025 Ediga Community. All rights reserved.</p>
                    <p>This is an automated message, please do not reply directly to this email.</p>
                </div>
            </body>
            </html>
          `;

          await transporter.sendMail({
            from: `"Ediga Community" <${process.env.EMAIL_USER}>`,
            to: reporter.email1,
            subject: `✅ Issue #${issueId} Assigned to Volunteers - ${title}`,
            html: reporterEmailHtml
          });
          emailSentCount++;
        }
      }

    } catch (notificationError) {
      console.error("Error sending notifications:", notificationError);
      // Don't throw error - continue with response
    }

    // Fetch the updated issue with all details
    const updatedIssue = await Issue.findByPk(issueId, {
      include: [
        {
          model: User,
          as: "user",
          attributes: ['id', 'full_name', 'email1', 'mobile1']
        },
        {
          model: User,
          as: "assignedMembers",
          through: {
            attributes: ['issue_status', 'created_at', 'updated_at', 'send_to_members']
          },
          attributes: [
            'id', 
            'full_name', 
            'email1', 
            'mobile1', 
            'mobile2',
            'member_photo',
            'city',
            'state',
            'district',
            'profession_id',
            'specialization_id',
            'blood_group',
            'age',
            'parent_name',
            'organisation',
            'booth_no',
            'pin_code',
            'member_type_id'
          ]
        }
      ]
    });

    // Filter assigned members by member_type_id = 2
    const assignedProfessionals = updatedIssue.assignedMembers?.filter(
      m => m.member_type_id === 2
    ) || [];

    return res.status(200).json({
      success: true,
      message: `${trulyNewMemberIds.length} professional(s) assigned successfully`,
      data: {
        issue: updatedIssue,
        assigned_professionals: assignedProfessionals,
        newly_assigned_count: trulyNewMemberIds.length,
        newly_assigned_ids: trulyNewMemberIds,
        status_updated: issue.status !== newIssueStatus,
        send_to_members: send_to_members,
        notifications_sent: notificationSentCount,
        emails_sent: emailSentCount
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error("Error assigning members:", error);
    return res.status(500).json({
      success: false,
      message: "Error assigning members to issue",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
          attributes: ['id', 'full_name', 'mobile1', 'email1', 'profession']
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
          attributes: ['id', 'full_name', 'mobile1', 'email1', 'profession', 'member_photo']
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