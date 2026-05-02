// Frontend render specification — mirrors server/render-spec.js
// Read by RenderField.jsx to decide how to display each field type.

export const PROFILE_RENDER = {
  full_name:    { render: 'text', label: '姓名' },
  gender:       { render: 'text', label: '性别' },
  age:          { render: 'text', label: '年龄' },
  phone:        { render: 'text', label: '电话' },
  email:        { render: 'text', label: '邮箱' },
  wechat:       { render: 'text', label: '微信' },
  github:       { render: 'text', label: 'GitHub' },
  location:     { render: 'text', label: '所在地' },
  graduation:   { render: 'date', label: '毕业时间' },
  target_role:  { render: 'text', label: '目标岗位' },
  summary:      { render: 'text', label: '求职定位' },
  skills:       { render: 'comma_list', label: '技能' },
  education: {
    render: 'card_list', label: '教育背景',
    fields: {
      school:       { render: 'text', label: '学校' },
      degree:       { render: 'text', label: '学历' },
      major:        { render: 'text', label: '专业' },
      start_date:   { render: 'date', label: '开始' },
      end_date:     { render: 'date', label: '结束' },
      gpa:          { render: 'text', label: 'GPA' },
      description:  { render: 'semicolon_list', label: '描述' },
    },
  },
  experience: {
    render: 'card_list', label: '工作经历',
    fields: {
      company:      { render: 'text', label: '公司' },
      position:     { render: 'text', label: '职位' },
      role:         { render: 'text', label: '角色' },
      start_date:   { render: 'date', label: '开始' },
      end_date:     { render: 'date', label: '结束' },
      description:  { render: 'semicolon_list', label: '工作内容' },
    },
  },
  projects: {
    render: 'card_list', label: '项目经历',
    fields: {
      name:         { render: 'text', label: '项目名' },
      role:         { render: 'text', label: '角色' },
      start_date:   { render: 'date', label: '开始' },
      end_date:     { render: 'date', label: '结束' },
      description:  { render: 'semicolon_list', label: '项目内容' },
      tech_stack:   { render: 'comma_list', label: '技术栈' },
    },
  },
}
