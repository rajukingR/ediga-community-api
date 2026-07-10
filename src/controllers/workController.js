// controllers/workController.js

import db from "../models/index.js";
import { Op, Sequelize } from "sequelize";
import nodemailer from "nodemailer";
import { sendPushToUser } from "../services/pushService.js";

const WorkManagement = db.WorkManagement;
const WorkManagementUser = db.WorkManagementUser;
const User = db.User;
const Notification = db.Notification;
const FcmToken = db.FcmToken;

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/* ======================================================
   BULK CREATE WORK
====================================================== */
export const bulkCreateWork = async (req, res) => {
    try {
        const {
            title,
            description,
            assigned_to,
            target_user_ids,
            priority,
        } = req.body;

        const attachments = req.files ? req.files.map(file => ({
            file_name: file.originalname,
            file_url: file.filename,
            file_size: file.size,
            mime_type: file.mimetype
        })) : [];

        // Parse assigned_to (member types)
        let parsedAssignedTo = [];
        if (assigned_to) {
            if (typeof assigned_to === "string") {
                try {
                    parsedAssignedTo = JSON.parse(assigned_to);
                } catch (e) {
                    parsedAssignedTo = assigned_to.split(",");
                }
            } else if (Array.isArray(assigned_to)) {
                parsedAssignedTo = assigned_to;
            }
        }

        // Parse target_user_ids (specific users)
        let parsedTargetUserIds = null;
        if (target_user_ids) {
            if (typeof target_user_ids === "string") {
                try {
                    parsedTargetUserIds = JSON.parse(target_user_ids);
                } catch (e) {
                    parsedTargetUserIds = target_user_ids.split(",").map(id => parseInt(id.trim()));
                }
            } else if (Array.isArray(target_user_ids)) {
                parsedTargetUserIds = target_user_ids;
            }
        }

        // Validate: either assigned_to or target_user_ids must be provided
        if ((!parsedAssignedTo || parsedAssignedTo.length === 0) && 
            (!parsedTargetUserIds || parsedTargetUserIds.length === 0)) {
            return res.status(400).json({
                success: false,
                message: "Either 'assigned_to' (member types) or 'target_user_ids' (specific users) must be provided"
            });
        }

        const assigner = req.user;
        
        if (!['admin', 'professional_volunteer'].includes(assigner.member_type)) {
            return res.status(403).json({
                success: false,
                message: "Only Admin and Professional Volunteers can assign work"
            });
        }

        const finalWorkId = `WRK-${Math.floor(100000 + Math.random() * 900000)}`;

        // Create work record
        const work = await WorkManagement.create({
            work_id: finalWorkId,
            title,
            description,
            assigned_by: assigner.id,
            assigned_to: parsedAssignedTo,
            target_user_ids: parsedTargetUserIds,
            priority: priority || 'medium',
            attachments,
        });

        // Get actual user IDs to assign work to
        let usersToAssign = [];
        
        if (parsedTargetUserIds && parsedTargetUserIds.length > 0) {
            usersToAssign = parsedTargetUserIds;
        } else if (parsedAssignedTo && parsedAssignedTo.length > 0) {
            // Get users by member type
            const users = await User.findAll({
                where: {
                    member_type: { [Op.in]: parsedAssignedTo },
                    status: "approved",
                    is_active: true
                },
                attributes: ['id']
            });
            usersToAssign = users.map(u => u.id);
        }

        // Create WorkManagementUser entries for each assigned user
        const workUserEntries = [];
        for (const userId of usersToAssign) {
            workUserEntries.push({
                work_management_id: work.id,
                user_id: userId,
                status: 'pending',
                created_at: new Date(),
                updated_at: new Date()
            });
        }
        
        if (workUserEntries.length > 0) {
            await WorkManagementUser.bulkCreate(workUserEntries);
        }

        // Send notifications to target users
        if (usersToAssign.length > 0) {
            const users = await User.findAll({
                where: { id: { [Op.in]: usersToAssign } }
            });

            for (const user of users) {
                await Notification.create({
                    user_id: user.id,
                    message: `New work assigned: ${title}`,
                    message_type: "work_assignment",
                    is_read: 0,
                    detail: {
                        work_id: work.work_id,
                        work_title: title,
                        description: description,
                        assigned_by: assigner.full_name,
                        priority: priority
                    },
                    photo: "work-icon.webp"
                });
            }
        }

        return res.status(201).json({
            success: true,
            message: "Work assigned successfully",
            data: work
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error creating work",
            error: error.message
        });
    }
};

/* ======================================================
   GET ALL WORK (MySQL Compatible)
====================================================== */
export const getAllWork = async (req, res) => {
    try {
        let { page = 1, limit = 10, status, priority, search } = req.query;
        const user = req.user;

        page = Number(page);
        limit = Number(limit);
        const offset = (page - 1) * limit;

        let where = {};

        if (user.member_type === 'admin') {
            if (status) where.status = status;
            if (priority) where.priority = priority;
        } else if (user.member_type === 'professional_volunteer') {
            // Get work IDs where user is assigned or is the assigner
            const assignedWorkUsers = await WorkManagementUser.findAll({
                where: { user_id: user.id },
                attributes: ['work_management_id']
            });
            const assignedWorkIds = assignedWorkUsers.map(wu => wu.work_management_id);
            
            where = {
                [Op.or]: [
                    { id: { [Op.in]: assignedWorkIds } },
                    { assigned_by: user.id }
                ]
            };
            if (status) where.status = status;
            if (priority) where.priority = priority;
        } else if (user.member_type === 'volunteer_member') {
            const assignedWorkUsers = await WorkManagementUser.findAll({
                where: { user_id: user.id },
                attributes: ['work_management_id']
            });
            const assignedWorkIds = assignedWorkUsers.map(wu => wu.work_management_id);
            
            where = {
                id: { [Op.in]: assignedWorkIds }
            };
            if (status) where.status = status;
            if (priority) where.priority = priority;
        } else {
            return res.status(200).json({
                success: true,
                total: 0,
                data: []
            });
        }

        if (search) {
            where[Op.or] = [
                { title: { [Op.like]: `%${search}%` } },
                { description: { [Op.like]: `%${search}%` } },
                { work_id: { [Op.like]: `%${search}%` } }
            ];
        }

        const { count, rows } = await WorkManagement.findAndCountAll({
            where,
            limit,
            offset,
            order: [["created_at", "DESC"]],
            include: [
                {
                    model: db.User,
                    as: 'assigner',
                    attributes: ['id', 'full_name', 'email1', 'member_type']
                },
                {
                    model: WorkManagementUser,
                    as: 'assigned_users',
                    include: [{
                        model: db.User,
                        as: 'user',
                        attributes: ['id', 'full_name', 'email1', 'mobile_1', 'district', 'member_type']
                    }]
                }
            ],
            distinct: true
        });

        return res.status(200).json({
            success: true,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            data: rows
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching work",
            error: error.message
        });
    }
};

/* ======================================================
   GET WORK BY ID (MySQL Compatible)
====================================================== */
export const getWorkById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        const work = await WorkManagement.findByPk(id, {
            include: [
                {
                    model: db.User,
                    as: 'assigner',
                    attributes: ['id', 'full_name', 'email1', 'member_type']
                },
                {
                    model: WorkManagementUser,
                    as: 'assigned_users',
                    include: [{
                        model: db.User,
                        as: 'user',
                        attributes: ['id', 'full_name', 'email1', 'mobile_1', 'district', 'member_type']
                    }]
                }
            ]
        });

        if (!work) {
            return res.status(404).json({
                success: false,
                message: "Work not found"
            });
        }

        // Check access permissions
        if (user.member_type !== 'admin') {
            const isAssigned = work.assigned_users?.some(au => au.user_id === user.id);
            const isAssigner = work.assigned_by === user.id;
            
            if (!isAssigned && !isAssigner) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view this work"
                });
            }
        }

        return res.status(200).json({
            success: true,
            data: work
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching work",
            error: error.message
        });
    }
};

/* ======================================================
   GET WORK BY WORK_ID
====================================================== */
export const getWorkByWorkId = async (req, res) => {
    try {
        const { work_id } = req.params;
        const user = req.user;

        const work = await WorkManagement.findOne({
            where: { work_id },
            include: [
                {
                    model: db.User,
                    as: 'assigner',
                    attributes: ['id', 'full_name', 'email1', 'member_type']
                },
                {
                    model: WorkManagementUser,
                    as: 'assigned_users',
                    include: [{
                        model: db.User,
                        as: 'user',
                        attributes: ['id', 'full_name', 'email1', 'mobile_1', 'district', 'member_type']
                    }]
                }
            ]
        });

        if (!work) {
            return res.status(404).json({
                success: false,
                message: "Work not found"
            });
        }

        // Check access permissions
        if (user.member_type !== 'admin') {
            const isAssigned = work.assigned_users?.some(au => au.user_id === user.id);
            const isAssigner = work.assigned_by === user.id;
            
            if (!isAssigned && !isAssigner) {
                return res.status(403).json({
                    success: false,
                    message: "You don't have permission to view this work"
                });
            }
        }

        return res.status(200).json({
            success: true,
            data: work
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching work",
            error: error.message
        });
    }
};

/* ======================================================
   UPDATE WORK STATUS (User specific)
====================================================== */
export const updateWorkStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, remarks } = req.body;
        const user = req.user;

        // Find the specific work-user assignment
        const workUser = await WorkManagementUser.findOne({
            where: {
                work_management_id: id,
                user_id: user.id
            },
            include: [{
                model: WorkManagement,
                as: 'work'
            }]
        });

        if (!workUser) {
            // Check if user is admin or assigner
            const work = await WorkManagement.findByPk(id);
            if (!work) {
                return res.status(404).json({
                    success: false,
                    message: "Work not found"
                });
            }
            
            if (user.member_type !== 'admin' && work.assigned_by !== user.id) {
                return res.status(403).json({
                    success: false,
                    message: "You are not assigned to this work"
                });
            }
            
            // For admin/assigner, update main work status without user-specific tracking
            const validStatuses = ['pending', 'in_progress', 'review', 'completed', 'blocked'];
            
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Allowed: ${validStatuses.join(', ')}`
                });
            }
            
            const oldStatus = work.status;
            work.status = status;
            await work.save();
            
            // Update all assigned users' status if work is completed
            if (status === 'completed') {
                await WorkManagementUser.update(
                    {
                        status: 'completed',
                        completed_at: new Date(),
                        updated_at: new Date()
                    },
                    {
                        where: { work_management_id: id }
                    }
                );
            }
            
            return res.status(200).json({
                success: true,
                message: "Work status updated successfully",
                data: work
            });
        }

        const validStatuses = ['pending', 'in_progress', 'review', 'completed', 'blocked'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed: ${validStatuses.join(', ')}`
            });
        }

        const oldStatus = workUser.status;
        workUser.status = status;
        
        if (remarks) {
            workUser.remarks = remarks;
        }
        
        if (status === 'completed') {
            workUser.completed_at = new Date();
        }
        
        workUser.updated_at = new Date();
        await workUser.save();

        // Update main work status based on all assigned users
        const allWorkUsers = await WorkManagementUser.findAll({
            where: { work_management_id: id }
        });
        
        const work = await WorkManagement.findByPk(id);
        const allCompleted = allWorkUsers.every(wu => wu.status === 'completed');
        
        if (allCompleted && work.status !== 'completed') {
            work.status = 'completed';
            await work.save();
        } else if (!allCompleted && work.status === 'completed') {
            work.status = 'in_progress';
            await work.save();
        }

        // Send notification to assigner about status change
        await Notification.create({
            user_id: work.assigned_by,
            message: `Work "${work.title}" status updated from ${oldStatus} to ${status} by ${user.full_name}`,
            message_type: "work_status_update",
            is_read: 0,
            detail: {
                work_id: work.work_id,
                work_title: work.title,
                old_status: oldStatus,
                new_status: status,
                updated_by: user.full_name,
                remarks: remarks
            },
            photo: "work-icon.webp"
        });

        return res.status(200).json({
            success: true,
            message: "Work status updated successfully",
            data: workUser
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error updating work status",
            error: error.message
        });
    }
};

/* ======================================================
   ADD PROGRESS NOTE
====================================================== */
export const addProgressNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        const user = req.user;

        if (!message || message.trim() === '') {
            return res.status(400).json({
                success: false,
                message: "Progress note message is required"
            });
        }

        const work = await WorkManagement.findByPk(id);

        if (!work) {
            return res.status(404).json({
                success: false,
                message: "Work not found"
            });
        }

        // Check permission
        const workUser = await WorkManagementUser.findOne({
            where: {
                work_management_id: id,
                user_id: user.id
            }
        });
        
        const isAssigner = work.assigned_by === user.id;
        
        if (!workUser && !isAssigner && user.member_type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to add notes to this work"
            });
        }

        const progressNotes = work.progress_notes || [];
        progressNotes.push({
            user_id: user.id,
            user_name: user.full_name,
            message: message,
            timestamp: new Date().toISOString()
        });
        
        work.progress_notes = progressNotes;
        await work.save();

        return res.status(200).json({
            success: true,
            message: "Progress note added successfully",
            data: work
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error adding progress note",
            error: error.message
        });
    }
};

/* ======================================================
   UPDATE WORK (Admin only)
====================================================== */
export const updateWork = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            description,
            assigned_to,
            target_user_ids,
            priority,
            status
        } = req.body;

        const user = req.user;

        // Only admin can update work details
        if (user.member_type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admin can update work details"
            });
        }

        const work = await WorkManagement.findByPk(id);

        if (!work) {
            return res.status(404).json({
                success: false,
                message: "Work not found"
            });
        }

        const updateData = {};

        if (title) updateData.title = title;
        if (description) updateData.description = description;
        if (priority) updateData.priority = priority;
        if (status) updateData.status = status;
        
        if (assigned_to) {
            let parsedAssignedTo = assigned_to;
            if (typeof assigned_to === "string") {
                try {
                    parsedAssignedTo = JSON.parse(assigned_to);
                } catch (e) {
                    parsedAssignedTo = assigned_to.split(",");
                }
            }
            updateData.assigned_to = parsedAssignedTo;
        }
        
        if (target_user_ids) {
            let parsedTargetUserIds = target_user_ids;
            if (typeof target_user_ids === "string") {
                try {
                    parsedTargetUserIds = JSON.parse(target_user_ids);
                } catch (e) {
                    parsedTargetUserIds = target_user_ids.split(",").map(id => parseInt(id.trim()));
                }
            }
            updateData.target_user_ids = parsedTargetUserIds;
            
            // Update WorkManagementUser entries for new users
            // Remove old assignments
            await WorkManagementUser.destroy({
                where: { work_management_id: id }
            });
            
            // Add new assignments
            const newWorkUsers = parsedTargetUserIds.map(userId => ({
                work_management_id: id,
                user_id: userId,
                status: 'pending',
                created_at: new Date(),
                updated_at: new Date()
            }));
            
            if (newWorkUsers.length > 0) {
                await WorkManagementUser.bulkCreate(newWorkUsers);
            }
        }

        // Handle new attachments
        if (req.files && req.files.length > 0) {
            const newAttachments = req.files.map(file => ({
                file_name: file.originalname,
                file_url: file.filename,
                file_size: file.size,
                mime_type: file.mimetype
            }));
            const currentAttachments = work.attachments || [];
            updateData.attachments = [...currentAttachments, ...newAttachments];
        }

        await work.update(updateData);

        return res.status(200).json({
            success: true,
            message: "Work updated successfully",
            data: work
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error updating work",
            error: error.message
        });
    }
};

/* ======================================================
   DELETE WORK (Admin only)
====================================================== */
export const deleteWork = async (req, res) => {
    try {
        const { id } = req.params;
        const user = req.user;

        // Only admin can delete work
        if (user.member_type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admin can delete work"
            });
        }

        const work = await WorkManagement.findByPk(id);

        if (!work) {
            return res.status(404).json({
                success: false,
                message: "Work not found"
            });
        }

        // Delete associated WorkManagementUser records first
        await WorkManagementUser.destroy({
            where: { work_management_id: id }
        });

        await work.destroy();

        return res.status(200).json({
            success: true,
            message: "Work deleted successfully"
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error deleting work",
            error: error.message
        });
    }
};

/* ======================================================
   GET WORK STATISTICS (MySQL Compatible)
====================================================== */
export const getWorkStatistics = async (req, res) => {
    try {
        const user = req.user;

        let workIds = [];
        
        if (user.member_type === 'admin') {
            const works = await WorkManagement.findAll({ attributes: ['id'] });
            workIds = works.map(w => w.id);
        } else if (user.member_type === 'professional_volunteer') {
            const assignedWorks = await WorkManagementUser.findAll({
                where: { user_id: user.id },
                attributes: ['work_management_id']
            });
            const assignedWorkIds = assignedWorks.map(w => w.work_management_id);
            
            const createdWorks = await WorkManagement.findAll({
                where: { assigned_by: user.id },
                attributes: ['id']
            });
            const createdWorkIds = createdWorks.map(w => w.id);
            
            workIds = [...new Set([...assignedWorkIds, ...createdWorkIds])];
        } else if (user.member_type === 'volunteer_member') {
            const assignedWorks = await WorkManagementUser.findAll({
                where: { user_id: user.id },
                attributes: ['work_management_id']
            });
            workIds = assignedWorks.map(w => w.work_management_id);
        } else {
            return res.status(200).json({
                success: true,
                data: {
                    total: 0,
                    pending: 0,
                    in_progress: 0,
                    review: 0,
                    completed: 0,
                    blocked: 0,
                    by_priority: {
                        low: 0,
                        medium: 0,
                        high: 0,
                        urgent: 0
                    }
                }
            });
        }

        const workList = await WorkManagement.findAll({
            where: { id: { [Op.in]: workIds } }
        });

        const stats = {
            total: workList.length,
            pending: 0,
            in_progress: 0,
            review: 0,
            completed: 0,
            blocked: 0,
            by_priority: {
                low: 0,
                medium: 0,
                high: 0,
                urgent: 0
            }
        };

        workList.forEach(work => {
            stats[work.status]++;
            stats.by_priority[work.priority]++;
        });

        // Get recent works (last 5)
        const recentWorks = await WorkManagement.findAll({
            where: { id: { [Op.in]: workIds } },
            limit: 5,
            order: [["created_at", "DESC"]],
            include: [{
                model: db.User,
                as: 'assigner',
                attributes: ['id', 'full_name']
            }]
        });

        return res.status(200).json({
            success: true,
            data: {
                ...stats,
                recent_works: recentWorks
            }
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching work statistics",
            error: error.message
        });
    }
};

/* ======================================================
   GET ASSIGNABLE USERS
====================================================== */
export const getAssignableUsers = async (req, res) => {
    try {
        const user = req.user;
        const { search } = req.query;

        let assignableRoles = [];

        if (user.member_type === 'admin') {
            assignableRoles = ['professional_volunteer', 'volunteer_member'];
        } else if (user.member_type === 'professional_volunteer') {
            assignableRoles = ['volunteer_member'];
        } else {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to assign work"
            });
        }

        const whereCondition = {
            member_type: { [Op.in]: assignableRoles },
            status: "approved",
            is_active: true
        };

        if (search) {
            whereCondition[Op.or] = [
                { full_name: { [Op.like]: `%${search}%` } },
                { email1: { [Op.like]: `%${search}%` } },
                { mobile_1: { [Op.like]: `%${search}%` } }
            ];
        }

        const users = await User.findAll({
            where: whereCondition,
            attributes: ['id', 'full_name', 'email1', 'member_type', 'mobile_1', 'district'],
            order: [['full_name', 'ASC']]
        });

        return res.status(200).json({
            success: true,
            data: users
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching assignable users",
            error: error.message
        });
    }
};

/* ======================================================
   BULK DELETE WORK
====================================================== */
export const bulkDeleteWork = async (req, res) => {
    try {
        const { ids } = req.body;
        const user = req.user;

        if (user.member_type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: "Only admin can delete work"
            });
        }

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Please provide an array of work IDs to delete"
            });
        }

        // Delete associated WorkManagementUser records first
        await WorkManagementUser.destroy({
            where: { work_management_id: { [Op.in]: ids } }
        });

        const deleted = await WorkManagement.destroy({
            where: {
                id: { [Op.in]: ids }
            }
        });

        return res.status(200).json({
            success: true,
            message: `${deleted} work(s) deleted successfully`,
            deletedCount: deleted
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error deleting work",
            error: error.message
        });
    }
};

/* ======================================================
   GET MY WORK (MySQL Compatible)
====================================================== */
export const getMyWork = async (req, res) => {
    try {
        const user = req.user;
        let { page = 1, limit = 10, status } = req.query;

        page = Number(page);
        limit = Number(limit);
        const offset = (page - 1) * limit;

        let workIds = [];

        if (user.member_type === 'professional_volunteer') {
            const assignedWorks = await WorkManagementUser.findAll({
                where: { user_id: user.id },
                attributes: ['work_management_id']
            });
            const assignedWorkIds = assignedWorks.map(w => w.work_management_id);
            
            const createdWorks = await WorkManagement.findAll({
                where: { assigned_by: user.id },
                attributes: ['id']
            });
            const createdWorkIds = createdWorks.map(w => w.id);
            
            workIds = [...new Set([...assignedWorkIds, ...createdWorkIds])];
        } else if (user.member_type === 'volunteer_member') {
            const assignedWorks = await WorkManagementUser.findAll({
                where: { user_id: user.id },
                attributes: ['work_management_id']
            });
            workIds = assignedWorks.map(w => w.work_management_id);
        } else {
            return res.status(200).json({
                success: true,
                total: 0,
                page,
                limit,
                totalPages: 0,
                data: []
            });
        }

        let where = { id: { [Op.in]: workIds } };
        if (status) where.status = status;

        const { count, rows } = await WorkManagement.findAndCountAll({
            where,
            limit,
            offset,
            order: [["created_at", "DESC"]],
            include: [
                {
                    model: db.User,
                    as: 'assigner',
                    attributes: ['id', 'full_name', 'email1', 'member_type']
                },
                {
                    model: WorkManagementUser,
                    as: 'assigned_users',
                    include: [{
                        model: db.User,
                        as: 'user',
                        attributes: ['id', 'full_name', 'email1', 'mobile_1', 'district', 'member_type']
                    }],
                    where: user.member_type === 'volunteer_member' ? { user_id: user.id } : {},
                    required: false
                }
            ],
            distinct: true
        });

        return res.status(200).json({
            success: true,
            total: count,
            page,
            limit,
            totalPages: Math.ceil(count / limit),
            data: rows
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching my work",
            error: error.message
        });
    }
};

/* ======================================================
   GET USER WORK STATUS (Get specific user's work status)
====================================================== */
export const getUserWorkStatus = async (req, res) => {
    try {
        const { work_id, user_id } = req.params;
        const currentUser = req.user;

        // Check permission
        if (currentUser.member_type !== 'admin' && currentUser.id !== parseInt(user_id)) {
            return res.status(403).json({
                success: false,
                message: "You don't have permission to view this user's work status"
            });
        }

        const workUser = await WorkManagementUser.findOne({
            where: {
                work_management_id: work_id,
                user_id: user_id
            },
            include: [
                {
                    model: WorkManagement,
                    as: 'work',
                    include: [{
                        model: db.User,
                        as: 'assigner',
                        attributes: ['id', 'full_name', 'email1']
                    }]
                },
                {
                    model: db.User,
                    as: 'user',
                    attributes: ['id', 'full_name', 'email1', 'member_type']
                }
            ]
        });

        if (!workUser) {
            return res.status(404).json({
                success: false,
                message: "User work assignment not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: workUser
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error fetching user work status",
            error: error.message
        });
    }
};