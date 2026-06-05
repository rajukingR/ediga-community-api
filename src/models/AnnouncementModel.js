export default (sequelize, DataTypes) => {
    const Announcement = sequelize.define(
        "Announcement",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            announcement_id: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
            },

            title: {
                type: DataTypes.STRING(255),
                allowNull: false,
            },

            description: {
                type: DataTypes.TEXT,
                allowNull: false,
            },

            file: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },

            receiver: {
                type: DataTypes.JSON,
                allowNull: false,
                validate: {
                    isValidReceiver(value) {
                        if (!Array.isArray(value)) {
                            throw new Error('Receiver must be an array');
                        }
                        const validTypes = ['member', 'volunteer_member', 'professional_volunteer', 'admin'];
                        for (const type of value) {
                            if (!validTypes.includes(type)) {
                                throw new Error(`Invalid receiver type: ${type}. Allowed: ${validTypes.join(', ')}`);
                            }
                        }
                    }
                }
            },

            target_user_ids: {
                type: DataTypes.JSON,
                allowNull: true,
                defaultValue: null
            },


            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
            },

            updated_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            tableName: "announcements",
            timestamps: false,
            hooks: {
                beforeUpdate: (announcement) => {
                    announcement.updated_at = new Date();
                }
            }
        }
    );

    return Announcement;
};