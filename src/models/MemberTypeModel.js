export default (sequelize, DataTypes) => {
  const MemberType = sequelize.define(
    "MemberType",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      member_type_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
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
      tableName: "member_types",
      timestamps: false,
    }
  );

  MemberType.associate = (models) => {
  MemberType.hasMany(models.User, {
    foreignKey: "member_type_id",
    as: "users",
  });
};

  return MemberType;
};