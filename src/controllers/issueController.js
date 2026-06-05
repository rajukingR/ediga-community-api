import db from "../models/index.js";
import { Op, Sequelize } from "sequelize";
import nodemailer from "nodemailer";
import { sendPushToUser } from "../services/pushService.js";

const Issue = db.Issue;
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
        attributes: ['id', 'full_name', 'email', 'mobile_1', 'member_type']
      });
    } catch (err) {
      console.error("Error fetching member:", err);
    }

    // Fetch all admin users
    let admins = [];
    try {
      admins = await User.findAll({
        where: {
          member_type: "admin",
          status: "approved",
          is_active: true
        },
        attributes: ['id', 'full_name', 'email'] // Make sure push_token is included
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
                email: member.email,
                mobile: member.mobile_1
              } : null,
              current_address: current_address,
              created_date: created_date
            },
            photo: "bell-icon.webp"
          });
          notificationSentCount++;

          // Send email to admin
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
                        <p><strong>Email:</strong> ${member.email || 'Not provided'}</p>
                        <p><strong>Mobile:</strong> ${member.mobile_1 || 'Not provided'}</p>
                        <p><strong>Member Type:</strong> ${member.member_type?.replace(/_/g, ' ') || 'Unknown'}</p>
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
                    <p>This is an automated message, please do not reply directly to this email.</p>
                </div>
            </body>
            </html>
          `;

          await transporter.sendMail({
            from: `"Ediga Community" <${process.env.EMAIL_USER}>`,
            to: admin.email,
            subject: `🆕 New Issue Reported: ${issue_id} - ${title}`,
            html: emailHtml
          });
          emailSentCount++;

        } catch (adminError) {
          console.error(`Failed to send email to admin ${admin.id}:`, adminError);
          failedNotifications.push({
            admin_id: admin.id,
            email: admin.email,
            type: 'email',
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
          console.error(`❌ Push error for admin ${admin.email}:`, error.message);
          failedNotifications.push({
            admin_id: admin.id,
            email: admin.email,
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

// controllers/issueController.js

/* ======================================================
   GET SINGLE ISSUE WITH ASSIGNED PROFESSIONALS AND VOLUNTEERS
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
    let assignedProfessionals = [];
    let assignedVolunteers = [];
    
    if (assignedMemberIds.length > 0) {
      const members = await User.findAll({
        where: {
          id: { [Op.in]: assignedMemberIds },
          is_active: true,
          status: "approved"
        },
        attributes: [
          'id', 'full_name', 'member_type', 'profession', 'category', 'email',
          'mobile_1', 'mobile_2', 'photo', 'years_of_experience',
          'organization', 'city', 'district', 'state', 'address',
          'member_id', 'taluk_zone', 'blood_group', 'date_of_birth', 'age'
        ]
      });

      allAssignedMembers = members.map(member => ({
        id: member.id,
        name: member.full_name,
        member_id: member.member_id || `MEM${member.id}`,
        member_type: member.member_type,
        profession: member.profession,
        category: member.category,
        email: member.email,
        mobile_1: member.mobile_1,
        mobile_2: member.mobile_2,
        years_of_experience: member.years_of_experience,
        photo: member.photo,
        organization: member.organization,
        city: member.city,
        district: member.district,
        state: member.state,
        address: member.address,
        taluk_zone: member.taluk_zone,
        blood_group: member.blood_group,
        date_of_birth: member.date_of_birth,
        age: member.age,
        assignment_status: memberStatusMap[member.id]?.issue_status || 'pending',
        remarks: memberStatusMap[member.id]?.remarks || null,
        assigned_at: memberStatusMap[member.id]?.assigned_at,
        status_updated_at: memberStatusMap[member.id]?.updated_at
      }));

      // Separate professionals and volunteers
      assignedProfessionals = allAssignedMembers.filter(
        member => member.member_type === "professional_volunteer"
      );
      
      assignedVolunteers = allAssignedMembers.filter(
        member => member.member_type === "volunteer_member"
      );
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
            'id', 'full_name', 'member_type', 'profession', 'category', 'email',
            'mobile_1', 'mobile_2', 'photo', 'years_of_experience',
            'organization', 'city', 'district', 'state', 'address', 'member_id'
          ]
        });

        const legacyMembersFormatted = legacyMembers.map(member => ({
          id: member.id,
          name: member.full_name,
          member_id: member.member_id || `MEM${member.id}`,
          member_type: member.member_type,
          profession: member.profession,
          category: member.category,
          email: member.email,
          mobile_1: member.mobile_1,
          mobile_2: member.mobile_2,
          years_of_experience: member.years_of_experience,
          photo: member.photo,
          organization: member.organization,
          city: member.city,
          district: member.district,
          state: member.state,
          address: member.address,
          assignment_status: 'pending',
          remarks: null,
          assigned_at: issueData.assigned_date,
          is_legacy: true
        }));

        // Add legacy members to respective arrays
        legacyMembersFormatted.forEach(member => {
          if (member.member_type === "professional_volunteer") {
            assignedProfessionals.push(member);
          } else if (member.member_type === "volunteer_member") {
            assignedVolunteers.push(member);
          }
        });
      }
    }

    // Add to response
    issueData.assigned_members = allAssignedMembers;
    issueData.assigned_professionals = assignedProfessionals;
    issueData.assigned_volunteers = assignedVolunteers;
    issueData.assignment_summary = {
      total_assigned: assignedProfessionals.length + assignedVolunteers.length,
      professionals_count: assignedProfessionals.length,
      volunteers_count: assignedVolunteers.length,
      pending_count: [...assignedProfessionals, ...assignedVolunteers].filter(m => m.assignment_status === 'pending').length,
      accepted_count: [...assignedProfessionals, ...assignedVolunteers].filter(m => m.assignment_status === 'accept').length,
      rejected_count: [...assignedProfessionals, ...assignedVolunteers].filter(m => m.assignment_status === 'reject').length
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
  try {
    const { issue_id, professional_ids, volunteer_ids } = req.body;
    const loginId = req.user.id;
    const loginUserRole = req.user.member_type;

    // Validate issue_id
    if (!issue_id) {
      return res.status(400).json({
        success: false,
        message: "Issue ID is required"
      });
    }

    // Determine which type of assignment is being made
    const isAssigningProfessionals = professional_ids && Array.isArray(professional_ids) && professional_ids.length > 0;
    const isAssigningVolunteers = volunteer_ids && Array.isArray(volunteer_ids) && volunteer_ids.length > 0;

    if (!isAssigningProfessionals && !isAssigningVolunteers) {
      return res.status(400).json({
        success: false,
        message: "Either professional_ids or volunteer_ids must be provided"
      });
    }

    // Authorization checks based on role
    if (isAssigningProfessionals && loginUserRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admin can assign professional volunteers"
      });
    }

    if (isAssigningVolunteers && loginUserRole !== "professional_volunteer" && loginUserRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only professional volunteers or admin can assign volunteer members"
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

    let memberIds = [];
    let memberTypeCondition = {};
    let assignmentType = "";

    // Set up conditions based on assignment type
    if (isAssigningProfessionals) {
      memberIds = professional_ids;
      memberTypeCondition = {
        member_type: {
          [Op.in]: ["professional_volunteer", "volunteer_member"]
        }
      };
      assignmentType = "professional";
    } else if (isAssigningVolunteers) {
      memberIds = volunteer_ids;
      memberTypeCondition = {
        member_type: "volunteer_member"
      };
      assignmentType = "volunteer";
    }

    // Find all members to assign
    const members = await User.findAll({
      where: {
        id: { [Op.in]: memberIds },
        ...memberTypeCondition,
        status: "approved",
        is_active: true
      }
    });

    if (members.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No valid ${assignmentType} members found`
      });
    }

    // For volunteer assignments, verify they are assigned to this professional volunteer (if not admin)
    if (assignmentType === "volunteer" && loginUserRole !== "admin") {
      const validVolunteers = await User.findAll({
        where: {
          id: { [Op.in]: memberIds },
          superior_id: loginId
        }
      });

      if (validVolunteers.length !== memberIds.length) {
        return res.status(403).json({
          success: false,
          message: "You can only assign volunteers that are assigned to you"
        });
      }
    }

    // Get existing assigned members from IssueMemberStatus
    const existingAssignments = await IssueMemberStatus.findAll({
      where: {
        issue_id: parseInt(issue_id),
        member_id: { [Op.in]: memberIds }
      },
      attributes: ['member_id']
    });

    const existingIds = existingAssignments.map(e => e.member_id);
    const trulyNewMemberIds = memberIds.filter(id => !existingIds.includes(id));

    if (trulyNewMemberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: `All selected ${assignmentType} members are already assigned to this issue`
      });
    }

    // Create pending status records for newly assigned members
    // Using only the columns that exist in your table
    const memberStatusRecords = trulyNewMemberIds.map(member_id => ({
      issue_id: parseInt(issue_id),
      member_id: member_id,
      issue_status: 'pending',  // Using 'pending' as default status
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
    
    const updatedAssignments = [...new Set([...currentAssignments, ...trulyNewMemberIds])];
    
    // Update issue status if it was pending
    const newIssueStatus = issue.status === "Pending" ? "In Progress" : issue.status;
    
    await issue.update({
      assigned_by: updatedAssignments,
      assigned_date: new Date(),
      status: newIssueStatus,
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
          through: { 
            attributes: ['issue_status', 'remarks'] // Only include columns that exist
          },
          attributes: ['id', 'full_name', 'member_type', 'profession', 'email', 'mobile_1', 'mobile_2', 'photo', 'years_of_experience', 'city', 'state', 'category']
        }
      ]
    });

    // Separate assigned members by type for response
    const assignedProfessionals = updatedIssue.assignedMembers?.filter(
      m => m.member_type === "professional_volunteer" || m.member_type === "volunteer_member"
    ) || [];
    
    const assignedVolunteers = updatedIssue.assignedMembers?.filter(
      m => m.member_type === "volunteer_member"
    ) || [];

    return res.status(200).json({
      success: true,
      message: `${trulyNewMemberIds.length} ${assignmentType}(s) assigned successfully`,
      data: {
        issue: updatedIssue,
        assigned_professionals: assignedProfessionals,
        assigned_volunteers: assignedVolunteers,
        newly_assigned_count: trulyNewMemberIds.length,
        assignment_type: assignmentType,
        newly_assigned_ids: trulyNewMemberIds
      }
    });

  } catch (error) {
    console.error("Error assigning members:", error);
    return res.status(500).json({
      success: false,
      message: "Error assigning members to issue",
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