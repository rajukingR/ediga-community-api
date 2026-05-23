export default (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      full_name: {
        type: DataTypes.STRING(150),
      },
      parents_name: {
        type: DataTypes.STRING(150),
      },
      member_type: {
        type: DataTypes.ENUM('admin', 'member', 'professional_volunteer', 'volunteer_member'),
        defaultValue: 'member',
        allowNull: false,
      },
      category: {
        type: DataTypes.STRING(50),
      },
      blood_group: {
        type: DataTypes.STRING(10),
      },
      date_of_birth: {
        type: DataTypes.DATEONLY,
      },
      age: {
        type: DataTypes.INTEGER,
      },
      voter_id: {
        type: DataTypes.STRING(50),
      },
      aadhaar_number: {
        type: DataTypes.STRING(20),
      },
      organization: {
        type: DataTypes.STRING(150),
      },
      profession: {
        type: DataTypes.STRING(100),
      },
      business_description: {
        type: DataTypes.TEXT,
      },
      address: {
        type: DataTypes.JSON,
        allowNull: true,
      },
      booth_no: {
        type: DataTypes.STRING(20),
      },
      taluk_zone: {
        type: DataTypes.STRING(100),
      },
      city: {
        type: DataTypes.STRING(100),
      },
      district: {
        type: DataTypes.STRING(100),
      },
      state: {
        type: DataTypes.STRING(100),
      },
      pin_code: {
        type: DataTypes.STRING(10),
      },
      ls_sabha: {
        type: DataTypes.STRING(100),
      },
      vs_sabha: {
        type: DataTypes.STRING(100),
      },
      mobile_1: {
        type: DataTypes.STRING(15),
      },
      mobile_2: {
        type: DataTypes.STRING(15),
      },
      phone_1: {
        type: DataTypes.STRING(15),
      },
      phone_2: {
        type: DataTypes.STRING(15),
      },
      email: {
        type: DataTypes.STRING(150),
      },
      password: {
        type: DataTypes.STRING(255),
      },
      status: {
        type: DataTypes.ENUM("pending", "approved", "rejected"),
        defaultValue: "pending",
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      remark: {
        type: DataTypes.TEXT,
      },
      document_file: {
        type: DataTypes.STRING(255),
      },
      photo: {
        type: DataTypes.STRING(255),
      },
      last_login: {
        type: DataTypes.DATE,
      },
      reset_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      reset_token_expiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      years_of_experience: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      service_type: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: null,
      },
      created_at: {
        type: DataTypes.DATE,
      },
      updated_at: {
        type: DataTypes.DATE,
      },
    },
    {
      tableName: "users",
      timestamps: false,
    }
  );

  // Associations
  User.associate = (models) => {
    // User has many Issues (as reporter)
    User.hasMany(models.Issue, {
      foreignKey: "user_id",
      as: "reportedIssues",
    });

    // User has many IssueMemberStatus as member
    User.hasMany(models.IssueMemberStatus, {
      foreignKey: "member_id",
      as: "issueStatuses",
    });


    // User belongs to many Issues through IssueMemberStatus (assigned issues)
    User.belongsToMany(models.Issue, {
      through: models.IssueMemberStatus,
      foreignKey: "member_id",
      otherKey: "issue_id",
      as: "assignedIssues",
    });
  };

  return User;
};