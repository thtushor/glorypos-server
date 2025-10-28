'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'parent_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Foreign key to parent user (shop). Null means this is a parent shop.'
    });

    // Add index for better performance
    await queryInterface.addIndex('Users', ['parent_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('Users', ['parent_id']);
    await queryInterface.removeColumn('Users', 'parent_id');
  }
};
