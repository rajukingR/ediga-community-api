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