// models/WorkManagement.js

export default (sequelize, DataTypes) => {
    const WorkManagement = sequelize.define(
        "WorkManagement",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            work_id: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
               
            },

            title: {
                type: DataTypes.STRING(255),
                allowNull: false,
                validate: {
                    notEmpty: true,
                    len: [3, 255]
                }
            },

            description: {
                type: DataTypes.TEXT,
                allowNull: false,
                validate: {
                    notEmpty: true
                }
            },

            assigned_by: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: 'users',
                    key: 'id'
                },
                validate: {
                    isInt: true,
                    min: 1
                }
            },

            assigned_to: {
                type: DataTypes.JSON,
                allowNull: false,
                validate: {
                    isValidReceiver(value) {
                        if (!Array.isArray(value)) {
                            throw new Error('Assigned to must be an array of member types');
                        }
                        const validTypes = ['professional_volunteer', 'volunteer_member'];
                        for (const type of value) {
                            if (!validTypes.includes(type)) {
                                throw new Error(`Invalid member type: ${type}. Allowed: ${validTypes.join(', ')}`);
                            }
                        }
                    }
                }
            },

            target_user_ids: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: null,
                validate: {
                    isValidTargetUsers(value) {
                        if (value && !Array.isArray(value)) {
                            throw new Error('Target user IDs must be an array');
                        }
                        if (value && value.length > 0) {
                            for (const userId of value) {
                                if (typeof userId !== 'number' || userId <= 0) {
                                    throw new Error('Each user ID must be a positive integer');
                                }
                            }
                        }
                    }
                }
            },

            priority: {
                type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
                allowNull: false,
                defaultValue: 'medium',
                validate: {
                    isIn: [['low', 'medium', 'high', 'urgent']]
                }
            },

            attachments: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: [],
                validate: {
                    isValidAttachments(value) {
                        if (value && !Array.isArray(value)) {
                            throw new Error('Attachments must be an array');
                        }
                    }
                }
            },

            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: false,
            },

            updated_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: false,
            },
        },
        {
            tableName: "work_management",
            timestamps: false,
        }

        
    );

    // Add associations
    WorkManagement.associate = (models) => {
        // WorkManagement belongs to User (as assigner)
        WorkManagement.belongsTo(models.User, {
            foreignKey: "assigned_by",
            as: "assigner",
            targetKey: "id"
        });

        WorkManagement.hasMany(models.WorkManagementUser, {
        foreignKey: "work_management_id",
        as: "assigned_users"
    });
        
        // Note: No direct association for assigned_to since it's JSON
        // You'll need to manually query users for assigned_to and target_user_ids
    };
    
    return WorkManagement;
};