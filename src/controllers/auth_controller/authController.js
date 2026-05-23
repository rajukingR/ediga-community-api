import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../models/index.js';
import { Op } from "sequelize";
import crypto from "crypto";
import nodemailer from "nodemailer";

const User = db.User;

// Helper function to calculate age from date of birth
const calculateAge = (dob) => {
  const today = new Date();
  const birthDate = new Date(dob);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Helper function to format user response
const formatUserResponse = (user) => {
  return {
    id: user.id,
    full_name: user.full_name,
    parents_name: user.parents_name,
    member_type: user.member_type,
    category: user.category,
    blood_group: user.blood_group,
    date_of_birth: user.date_of_birth,
    age: user.age,
    years_of_experience: user.years_of_experience,
    service_type: user.service_type, // Added new field
    voter_id: user.voter_id,
    aadhaar_number: user.aadhaar_number,
    organization: user.organization,
    profession: user.profession,
    business_description: user.business_description,
    address: user.address,
    booth_no: user.booth_no,
    taluk_zone: user.taluk_zone,
    city: user.city,
    district: user.district,
    state: user.state,
    pin_code: user.pin_code,
    ls_sabha: user.ls_sabha,
    vs_sabha: user.vs_sabha,
    mobile_1: user.mobile_1,
    mobile_2: user.mobile_2,
    phone_1: user.phone_1,
    phone_2: user.phone_2,
    email: user.email,
    status: user.status,
    is_active: user.is_active,
    remark: user.remark,
    document_file: user.document_file,
    photo: user.photo,
    last_login: user.last_login,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
};

// =========================
// SIGNUP / REGISTRATION
// =========================
export const signup = async (req, res) => {
  try {
    const {
      full_name,
      parents_name,
      member_type,
      category,
      blood_group,
      date_of_birth,
      age,
      years_of_experience,
      service_type, // Added new field
      voter_id,
      aadhaar_number,
      organization,
      profession,
      business_description,
      address,
      booth_no,
      taluk_zone,
      city,
      district,
      state,
      pin_code,
      ls_sabha,
      vs_sabha,
      mobile_1,
      mobile_2,
      phone_1,
      phone_2,
      email,
      password,
      remark
    } = req.body;

    // REQUIRED VALIDATION
    if (!full_name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required",
      });
    }

    // EMAIL CHECK
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // MOBILE CHECK (if provided)
    if (mobile_1) {
      const existingMobile = await User.findOne({ where: { mobile_1 } });
      if (existingMobile) {
        return res.status(400).json({
          success: false,
          message: "Mobile number already registered",
        });
      }
    }

    // Validate service_type for volunteer members
    if (member_type === 'volunteer_member' && !service_type) {
      return res.status(400).json({
        success: false,
        message: "Service type is required for volunteer members",
      });
    }

    // PASSWORD HASH
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle file uploads
    const document_file = req.files?.document_file?.[0]?.filename || null;
    const photo = req.files?.photo?.[0]?.filename || null;

    let parsedAddress = address;

    if (typeof address === "string") {
      try {
        parsedAddress = JSON.parse(address);
      } catch (err) {
        parsedAddress = null;
      }
    }

    // CREATE USER
    const newUser = await User.create({
      full_name,
      parents_name,
      member_type,
      category,
      blood_group,
      date_of_birth,
      age: age || (date_of_birth ? calculateAge(date_of_birth) : null),
      years_of_experience: years_of_experience || null,
      service_type: member_type === 'volunteer_member' ? service_type : null, // Added new field
      voter_id,
      aadhaar_number,
      organization,
      profession,
      business_description,
      address: parsedAddress,
      booth_no,
      taluk_zone,
      city,
      district,
      state,
      pin_code,
      ls_sabha,
      vs_sabha,
      mobile_1,
      mobile_2,
      phone_1,
      phone_2,
      email,
      password: hashedPassword,
      status: "pending",
      is_active: true,
      remark,
      document_file,
      photo,
      created_at: new Date(),
      updated_at: new Date()
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: formatUserResponse(newUser),
    });
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Signup failed",
      error: error.message,
    });
  }
};

// =========================
// SIGNIN / LOGIN
// =========================
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact admin.",
      });
    }

    // Check status (pending/approved/rejected)
    if (user.status === "rejected") {
      return res.status(403).json({
        success: false,
        message: "Your registration has been rejected. Please contact admin.",
      });
    }

    if (user.status === "pending") {
      return res.status(403).json({
        success: false,
        message: "Your account is pending approval. Please wait for admin verification.",
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Update last login
    await user.update({ last_login: new Date() });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        member_type: user.member_type,
        status: user.status
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      success: true,
      message: "Signin successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        member_type: user.member_type,
        email: user.email,
        mobile_1: user.mobile_1,
        address: user.address,
        photo: user.photo,
        status: user.status,
        is_active: user.is_active,
        service_type: user.service_type, // Added new field
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({
      success: false,
      message: "Error signing in",
      error: error.message,
    });
  }
};

// =========================
// GET ALL USERS (with filters)
// =========================
export const getAllUsers = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      status,
      is_active,
      category,
      district,
      booth_no,
      service_type, // Added new filter
      search
    } = req.query;

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    // Build where conditions
    const whereConditions = {};

    if (status) whereConditions.status = status;
    if (is_active !== undefined) whereConditions.is_active = is_active === 'true';
    if (category) whereConditions.category = category;
    if (district) whereConditions.district = district;
    if (booth_no) whereConditions.booth_no = booth_no;
    if (service_type) whereConditions.service_type = service_type; // Added new filter

    if (search) {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { mobile_1: { [Op.like]: `%${search}%` } },
        { voter_id: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    const formattedUsers = rows.map(user => formatUserResponse(user));

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: formattedUsers,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// =========================
// GET ALL PENDING USERS (excluding admin)
// =========================
export const getAllPendingUsers = async (req, res) => {
  try {
    let { page = 1, limit = 10, member_type, service_type, search } = req.query; // Added service_type

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    // Build where conditions for pending users
    const whereConditions = {
      status: 'pending',
      member_type: {
        [Op.ne]: 'admin' // Exclude admin users
      }
    };

    // Filter by specific member type if provided
    if (member_type && ['member', 'professional_volunteer', 'volunteer_member'].includes(member_type)) {
      whereConditions.member_type = member_type;
    }

    // Filter by service type for volunteer members
    if (service_type) {
      whereConditions.service_type = service_type;
    }

    // Search functionality
    if (search) {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { mobile_1: { [Op.like]: `%${search}%` } },
        { profession: { [Op.like]: `%${search}%` } },
        { organization: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      limit,
      offset,
      order: [["created_at", "DESC"]],
      attributes: { exclude: ['password'] }
    });

    const formatted = rows.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parents_name: user.parents_name,
      member_type: user.member_type,
      category: user.category,
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      service_type: user.service_type, // Added new field
      voter_id: user.voter_id,
      aadhaar_number: user.aadhaar_number,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching pending users:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching pending users",
      error: error.message,
    });
  }
};

// =========================
// GET ALL APPROVED MEMBERS (member_type = 'member')
// =========================
export const getAllMembers = async (req, res) => {
  try {
    let { page = 1, limit = 10, category, search, is_active } = req.query;

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    // Build where conditions for regular members
    const whereConditions = {
      member_type: 'member',
      status: 'approved'
    };

    // Additional filters
    if (category) whereConditions.category = category;
    if (is_active !== undefined) whereConditions.is_active = is_active === 'true';

    if (search) {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { profession: { [Op.like]: `%${search}%` } },
        { organization: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { district: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      limit,
      offset,
      order: [["created_at", "DESC"]],
      attributes: { exclude: ['password'] }
    });

    const formatted = rows.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parents_name: user.parents_name,
      member_type: user.member_type,
      category: user.category,
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      service_type: user.service_type, // Added new field
      voter_id: user.voter_id,
      aadhaar_number: user.aadhaar_number,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching members:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching members",
      error: error.message,
    });
  }
};

// =========================
// GET ALL APPROVED VOLUNTEER MEMBERS (member_type = 'volunteer_member')
// =========================
export const getAllVolunteerMembers = async (req, res) => {
  try {
    let { page = 1, limit = 10, category, service_type, search, is_active } = req.query; // Added service_type

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    // Build where conditions for volunteer members
    const whereConditions = {
      member_type: 'volunteer_member',
      status: 'approved'
    };

    // Additional filters
    if (category) whereConditions.category = category;
    if (service_type) whereConditions.service_type = service_type; // Added service_type filter
    if (is_active !== undefined) whereConditions.is_active = is_active === 'true';

    if (search) {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { profession: { [Op.like]: `%${search}%` } },
        { organization: { [Op.like]: `%${search}%` } },
        { business_description: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      limit,
      offset,
      order: [["created_at", "DESC"]],
      attributes: { exclude: ['password'] }
    });

    const formatted = rows.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parents_name: user.parents_name,
      member_type: user.member_type,
      category: user.category,
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      service_type: user.service_type, // Added new field
      voter_id: user.voter_id,
      aadhaar_number: user.aadhaar_number,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching volunteer members:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching volunteer members",
      error: error.message,
    });
  }
};

// =========================
// GET ALL APPROVED PROFESSIONAL VOLUNTEERS (member_type = 'professional_volunteer')
// =========================
export const getAllProfessionalVolunteers = async (req, res) => {
  try {
    let { page = 1, limit = 10, category, search, is_active } = req.query;

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    // Build where conditions for professional volunteers
    const whereConditions = {
      member_type: 'professional_volunteer',
      status: 'approved'
    };

    // Additional filters
    if (category) whereConditions.category = category;
    if (is_active !== undefined) whereConditions.is_active = is_active === 'true';

    if (search) {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { profession: { [Op.like]: `%${search}%` } },
        { organization: { [Op.like]: `%${search}%` } },
        { business_description: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      limit,
      offset,
      order: [["created_at", "DESC"]],
      attributes: { exclude: ['password'] }
    });

    const formatted = rows.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parents_name: user.parents_name,
      member_type: user.member_type,
      category: user.category,
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      service_type: user.service_type, // Added new field
      voter_id: user.voter_id,
      aadhaar_number: user.aadhaar_number,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching professional volunteers:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching professional volunteers",
      error: error.message,
    });
  }
};

// =========================
// GET ACTIVE PROFESSIONAL VOLUNTEERS (with issue type filtering)
// =========================
export const getActiveProfessionalVolunteers = async (req, res) => {
  try {
    let { issue_type, category, location, search, min_experience, max_experience, service_type } = req.query;

    // Handle issue_type if it's an array (from multiple query params)
    if (Array.isArray(issue_type)) {
      const uniqueIssues = [...new Set(issue_type.filter(Boolean))];
      issue_type = uniqueIssues[0] || null;
    }


    // Build where conditions
    const whereConditions = {
      is_active: true,
      member_type: {
        [Op.in]: ["professional_volunteer", "volunteer_member"]
      },
      status: "approved"
    };

    // STRICT FILTERING - Required field
    if (!issue_type || !issue_type.trim()) {
      return res.status(400).json({
        success: false,
        message: "issue_type is required",
        data: []
      });
    }

    // Define category mapping for issue types
    const categoryMapping = {
      'Medical Facility': ['Doctor', 'Medical', 'Healthcare', 'Cardiologist', 'Neurologist', 'Orthopedic', 'Pediatrician', 'Gynecologist', 'Surgeon'],
      'Medical Camp': ['Doctor', 'Medical', 'Healthcare', 'Nurse', 'Paramedic'],
      'Healthcare': ['Doctor', 'Medical', 'Healthcare', 'Nurse', 'Physician', 'Dentist'],
      'Legal Aid': ['Legal', 'Lawyer', 'Advocate', 'Attorney', 'Legal Advisor'],
      'Legal Awareness': ['Legal', 'Lawyer', 'Advocate', 'Attorney', 'Legal Consultant'],
      'Education': ['Education', 'Teacher', 'Educator', 'Professor', 'Tutor', 'Trainer'],
      'Digital Literacy': ['IT', 'Technology', 'Engineer', 'Computer', 'Digital', 'Programmer'],
      'Financial Literacy': ['Finance', 'Accountant', 'CA', 'Financial', 'Banking', 'Chartered Accountant'],
      'Housing': ['Housing', 'Architect', 'Civil Engineer', 'Construction', 'Real Estate'],
      'Women Empowerment': ['Women', 'Social Work', 'Counselor', 'NGO', 'Gender'],
      'Senior Citizens': ['Elderly', 'Senior Care', 'Geriatric', 'Social Work'],
      'Environment': ['Environment', 'Ecology', 'Conservation', 'Climate', 'Green'],
      'Business Development': ['Business', 'Entrepreneurship', 'Management', 'Consulting'],
      'Agriculture': ['Agriculture', 'Farming', 'Agronomy', 'Horticulture'],
      'Community Service': ['Community', 'Social Work', 'NGO', 'Volunteer'],
      'Infrastructure': ['Infrastructure', 'Civil Engineer', 'Construction', 'Urban Planning'],
      'Public Safety': ['Safety', 'Security', 'Police', 'Defense', 'Emergency'],
      'Blood Donation': ['Medical', 'Healthcare', 'Doctor', 'Blood Bank']
    };

    const allowedCategories = categoryMapping[issue_type] || [];
    


    // IMPORTANT FIX: Filter by category AND profession
    // The category field must match the allowed categories
    whereConditions.category = {
      [Op.in]: allowedCategories
    };

    // Also check profession as a secondary filter
    const professionKeywords = {
      'Medical Facility': ['Doctor', 'Medical', 'Healthcare', 'Physician', 'Cardiologist', 'Neurologist', 'Orthopedic'],
      'Medical Camp': ['Doctor', 'Medical', 'Healthcare', 'Nurse', 'Paramedic'],
      'Healthcare': ['Doctor', 'Medical', 'Healthcare', 'Nurse', 'Physician'],
      'Legal Aid': ['Lawyer', 'Advocate', 'Legal', 'Attorney'],
      'Legal Awareness': ['Lawyer', 'Advocate', 'Legal', 'Attorney'],
      'Education': ['Teacher', 'Educator', 'Education', 'Professor', 'Tutor'],
      'Digital Literacy': ['Engineer', 'IT', 'Computer', 'Technology', 'Programmer'],
      'Financial Literacy': ['Chartered Accountant', 'Accountant', 'Finance', 'CA'],
      'Housing': ['Architect', 'Civil Engineer', 'Construction'],
      'Women Empowerment': ['Social Worker', 'Counselor'],
      'Senior Citizens': ['Social Worker', 'Counselor'],
      'Environment': ['Environmentalist', 'Ecologist'],
      'Business Development': ['Business', 'Entrepreneur', 'Economist'],
      'Agriculture': ['Agricultural', 'Agronomist'],
      'Community Service': ['Social Worker', 'Volunteer'],
      'Infrastructure': ['Engineer', 'Architect', 'Civil Engineer'],
      'Public Safety': ['Security', 'Safety'],
      'Blood Donation': ['Doctor', 'Medical', 'Healthcare']
    };

    const professionKeywordsList = professionKeywords[issue_type] || [];
    
    if (professionKeywordsList.length > 0) {
      // Add profession filter as well for stricter matching
      const professionConditions = professionKeywordsList.map(keyword => ({
        profession: { [Op.like]: `%${keyword}%` }
      }));
      
      // Combine category and profession filters
      whereConditions[Op.and] = [
        { category: { [Op.in]: allowedCategories } },
        { [Op.or]: professionConditions }
      ];
      
      // Remove the direct category filter since we're using Op.and
      delete whereConditions.category;
    }

    // Additional filters
    if (category && category.trim()) {
      if (whereConditions[Op.and]) {
        whereConditions[Op.and].push({ category: category });
      } else {
        whereConditions.category = category;
      }
    }

    if (location && location.trim()) {
      const locationCondition = {
        [Op.or]: [
          { city: { [Op.like]: `%${location}%` } },
          { district: { [Op.like]: `%${location}%` } },
          { state: { [Op.like]: `%${location}%` } }
        ]
      };
      
      if (whereConditions[Op.and]) {
        whereConditions[Op.and].push(locationCondition);
      } else {
        whereConditions[Op.and] = [locationCondition];
      }
    }

    if (search && search.trim()) {
      const searchCondition = {
        [Op.or]: [
          { full_name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { mobile_1: { [Op.like]: `%${search}%` } },
          { profession: { [Op.like]: `%${search}%` } }
        ]
      };
      
      if (whereConditions[Op.and]) {
        whereConditions[Op.and].push(searchCondition);
      } else {
        whereConditions[Op.and] = [searchCondition];
      }
    }

    if (min_experience || max_experience) {
      const experienceCondition = {};
      if (min_experience) experienceCondition[Op.gte] = parseInt(min_experience);
      if (max_experience) experienceCondition[Op.lte] = parseInt(max_experience);
      whereConditions.years_of_experience = experienceCondition;
    }

    const users = await User.findAll({
      where: whereConditions,
      order: [
        ["years_of_experience", "DESC"],
        ["full_name", "ASC"]
      ],
    });


    const formatted = users.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parents_name: user.parents_name,
      member_type: user.member_type,
      category: user.category,
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      service_type: user.service_type,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      filters: { issue_type, category, location, search, min_experience, max_experience, service_type },
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching professionals:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching professionals",
      error: error.message,
    });
  }
};

// =========================
// GET ACTIVE USERS
// =========================
export const getActiveUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        is_active: true,
        status: "approved"
      },
      order: [["full_name", "ASC"]],
    });

    const formatted = users.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parents_name: user.parents_name,
      category: user.category,
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      service_type: user.service_type, // Added new field
      voter_id: user.voter_id,
      aadhaar_number: user.aadhaar_number,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching active users:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching active users",
      error: error.message,
    });
  }
};

// =========================
// GET USER BY ID
// =========================
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: formatUserResponse(user)
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message
    });
  }
};

// =========================
// UPDATE USER
// =========================
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updateData = { ...req.body };

    // Validate service_type for volunteer members
    if (updateData.member_type === 'volunteer_member' && updateData.service_type === '') {
      return res.status(400).json({
        success: false,
        message: "Service type is required for volunteer members",
      });
    }

    // If updating to non-volunteer member, clear service_type
    if (updateData.member_type && updateData.member_type !== 'volunteer_member') {
      updateData.service_type = null;
    }

    // Parse address if it's a string
    if (updateData.address && typeof updateData.address === 'string') {
      try {
        updateData.address = JSON.parse(updateData.address);
      } catch (error) {
        console.error("Error parsing address:", error);
        updateData.address = {};
      }
    }

    // IMPORTANT: Validate is_active based on status
    if (updateData.is_active !== undefined) {
      const isActive = updateData.is_active === true || updateData.is_active === 1 || updateData.is_active === '1';
      
      if (isActive && updateData.status !== 'approved') {
        updateData.status = 'approved';
        console.log(`Auto-setting status to approved for user ${id} because is_active is set to true`);
      } else if (!isActive && updateData.status === 'approved') {
        console.log(`User ${id} is being deactivated while status is approved`);
      }
    }

    // Handle password update separately
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    // Handle file uploads
    if (req.files) {
      if (req.files.document_file) {
        updateData.document_file = req.files.document_file[0].filename;
      }
      if (req.files.photo) {
        updateData.photo = req.files.photo[0].filename;
      }
    }

    // Auto-calculate age if date_of_birth is updated
    if (updateData.date_of_birth && !updateData.age) {
      updateData.age = calculateAge(updateData.date_of_birth);
    }

    updateData.updated_at = new Date();

    await user.update(updateData);

    // Fetch updated user to return latest data
    const updatedUser = await User.findByPk(id);

    res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: formatUserResponse(updatedUser)
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

// =========================
// UPDATE USER STATUS (Approve/Reject)
// =========================
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remark } = req.body;

    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status (pending/approved/rejected) is required"
      });
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const isActive = status === 'approved' ? true : false;

    await user.update({
      status,
      is_active: isActive,
      remark: remark || user.remark,
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      message: `User ${status} successfully`,
      data: formatUserResponse(user)
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({
      success: false,
      message: "Error updating user status",
      error: error.message
    });
  }
};

// =========================
// DELETE USER
// =========================
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await user.destroy();

    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message
    });
  }
};

// =========================
// SEND RESET PASSWORD LINK
// =========================
export const sendResetPasswordLink = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000);

    await user.update({
      reset_token: resetToken,
      reset_token_expiry: expiryTime
    });

    const resetURL = `${process.env.DOMAIN_URL}/reset-password/${resetToken}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Link",
      html: `
        <p>Hello ${user.full_name},</p>
        <p>Click the link below to reset your password (Valid for 10 minutes):</p>
        <a href="${resetURL}">${resetURL}</a>
      `
    });

    res.status(200).json({
      success: true,
      message: "Reset password link sent successfully"
    });
  } catch (error) {
    console.error("Error sending reset link:", error);
    res.status(500).json({
      success: false,
      message: "Error sending reset link",
      error: error.message
    });
  }
};

// =========================
// RESET PASSWORD
// =========================
export const resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({
        success: false,
        message: "Token and new password required"
      });
    }

    const user = await User.findOne({
      where: {
        reset_token: token,
        reset_token_expiry: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Token invalid or expired"
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await user.update({
      password: hashedPassword,
      reset_token: null,
      reset_token_expiry: null,
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting password",
      error: error.message
    });
  }
};

// =========================
// CHECK RESET TOKEN
// =========================
export const checkResetToken = async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findOne({
      where: {
        reset_token: token,
        reset_token_expiry: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Token valid"
    });
  } catch (err) {
    console.error("Error checking token:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// =========================
// GET STATISTICS
// =========================
export const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const approvedUsers = await User.count({ where: { status: 'approved' } });
    const pendingUsers = await User.count({ where: { status: 'pending' } });
    const rejectedUsers = await User.count({ where: { status: 'rejected' } });
    const activeUsers = await User.count({ where: { is_active: true } });

    // Statistics by service type for volunteer members
    const serviceTypeStats = await User.findAll({
      attributes: ['service_type', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']],
      where: { 
        member_type: 'volunteer_member',
        service_type: { [Op.ne]: null }
      },
      group: ['service_type']
    });

    // Count by district
    const districtStats = await User.findAll({
      attributes: ['district', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']],
      where: { district: { [Op.ne]: null } },
      group: ['district']
    });

    // Count by booth
    const boothStats = await User.findAll({
      attributes: ['booth_no', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']],
      where: { booth_no: { [Op.ne]: null } },
      group: ['booth_no']
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalUsers,
        approved: approvedUsers,
        pending: pendingUsers,
        rejected: rejectedUsers,
        active: activeUsers,
        by_service_type: serviceTypeStats, // Added service type statistics
        by_district: districtStats,
        by_booth: boothStats
      }
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message
    });
  }
};